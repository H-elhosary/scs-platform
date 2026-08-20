const API_BASE = '';

// Wrapper around fetch() that attaches the logged-in session token and tenant id
// to every same-origin API call. All clinic dashboard routes now require auth —
// pages must use this (not raw fetch) so the server can identify the caller.
function authFetch(url, options = {}) {
  const tenantId = localStorage.getItem('tenant_id') || '';
  const token = localStorage.getItem('auth_token') || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

// Global shared state
let allPatients = [];
let allServices = [];
let allDoctors = [];
let workingHoursData = [];
let allowMultiDoctor = false;
let allowInsurance = false;
let allowRefunds = false;
let aptSelectedLocation = "";

// Common Initialization
document.addEventListener('DOMContentLoaded', async () => {
  injectSidebarAndShell();
  await loadBaseLayoutData();
  await loadGlobalData();
  
  // Custom event trigger so page scripts know shared data is ready
  document.dispatchEvent(new CustomEvent('sharedDataReady'));
});

// 1. Inject Sidebar and Toast Container
function injectSidebarAndShell() {
  // Inject Toast container if not present
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    tc.className = 'toast-container';
    document.body.appendChild(tc);
  }

  const layout = document.querySelector('.clinic-layout');
  if (layout && !document.getElementById('clinic-sidebar')) {
    const aside = document.createElement('aside');
    aside.className = 'clinic-sidebar';
    aside.id = 'clinic-sidebar';
    
    // Read persisted state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      aside.classList.add('collapsed');
    }
    
    aside.innerHTML = `
      <div class="sidebar-brand">
        <div class="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
        </div>
        <div class="sidebar-brand-text">
          <h3 id="sidebar-clinic-name">عيادة النور</h3>
          <span>طب أسنان عام</span>
        </div>
        <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" onclick="toggleSidebarCollapse()" aria-label="Toggle Sidebar">
          <i id="sidebar-toggle-icon" class="fa-solid ${isCollapsed ? 'fa-angle-left' : 'fa-angle-right'}"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-link" id="nav-dashboard">
          <i class="fa-solid fa-house-medical"></i>
          <span>الرئيسية</span>
        </a>
        <a href="calendar.html" class="sidebar-link" id="nav-calendar">
          <i class="fa-solid fa-calendar-days"></i>
          <span>التقويم والمواعيد</span>
        </a>
        <a href="patients.html" class="sidebar-link" id="nav-patients">
          <i class="fa-solid fa-users"></i>
          <span>المرضى</span>
          <span class="sidebar-badge" id="patients-count-badge"></span>
        </a>
        <a href="exam.html" class="sidebar-link" id="nav-exam">
          <i class="fa-solid fa-tooth"></i>
          <span>غرفة الكشف</span>
        </a>
        <a href="inbox.html" class="sidebar-link" id="nav-inbox">
          <i class="fa-solid fa-comments"></i>
          <span>صندوق الوارد</span>
          <span class="sidebar-badge badge-danger" id="inbox-unread-badge"></span>
        </a>

        <div class="sidebar-divider"></div>

        <a href="tickets.html" class="sidebar-link" id="nav-tickets">
          <i class="fa-solid fa-clipboard-list"></i>
          <span>الطلبات والدعم</span>
        </a>

        <a href="settings.html" class="sidebar-link" id="nav-settings">
          <i class="fa-solid fa-gear"></i>
          <span>الإعدادات</span>
        </a>
        <a href="waiting_room_tv.html" class="sidebar-link" target="_blank" id="nav-tv">
          <i class="fa-solid fa-tv"></i>
          <span>شاشة الانتظار</span>
          <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px; margin-right: auto; opacity: 0.5;"></i>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar"><i class="fa-solid fa-user-doctor"></i></div>
          <div class="sidebar-user-info">
            <span class="sidebar-user-name">د. محمد نور</span>
            <span class="sidebar-user-role">مالك العيادة</span>
          </div>
        </div>
        <a href="index.html" class="sidebar-link logout-link">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>تسجيل خروج</span>
        </a>
      </div>
    `;
    
    layout.insertBefore(aside, layout.firstChild);
    highlightActiveLink();

    // --- Mobile Sidebar Drawer Support ---
    // Inject backdrop
    if (!document.getElementById('sidebar-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.className = 'sidebar-backdrop';
      backdrop.addEventListener('click', closeMobileSidebar);
      document.body.appendChild(backdrop);
    }

    // Inject floating mobile menu button
    if (!document.getElementById('mobile-menu-btn')) {
      const menuBtn = document.createElement('button');
      menuBtn.id = 'mobile-menu-btn';
      menuBtn.className = 'mobile-menu-btn';
      menuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
      menuBtn.setAttribute('aria-label', 'فتح القائمة');
      menuBtn.addEventListener('click', toggleMobileSidebar);
      document.body.appendChild(menuBtn);
    }
  }
}

// Toggle logic
function toggleSidebarCollapse() {
  const sidebar = document.getElementById('clinic-sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  const btnIcon = document.getElementById('sidebar-toggle-icon');
  if (btnIcon) {
    if (sidebar.classList.contains('collapsed')) {
      btnIcon.className = 'fa-solid fa-angle-left';
      localStorage.setItem('sidebarCollapsed', 'true');
    } else {
      btnIcon.className = 'fa-solid fa-angle-right';
      localStorage.setItem('sidebarCollapsed', 'false');
    }
  }
}

// Mobile sidebar toggle functions
function toggleMobileSidebar() {
  const sidebar = document.getElementById('clinic-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

function openMobileSidebar() {
  const sidebar = document.getElementById('clinic-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('clinic-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

// Highlight active sidebar item
function highlightActiveLink() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'dashboard.html';
  const activeLinkId = {
    'dashboard.html': 'nav-dashboard',
    'calendar.html': 'nav-calendar',
    'patients.html': 'nav-patients',
    'inbox.html': 'nav-inbox',
    'settings.html': 'nav-settings',
    'tickets.html': 'nav-tickets'
  }[filename] || 'nav-dashboard';
  
  const activeLink = document.getElementById(activeLinkId);
  if (activeLink) activeLink.classList.add('active');
}

// 2. Load Base Layout Stats
async function loadBaseLayoutData() {
  try {
    const statsRes = await authFetch(`${API_BASE}/v1/dashboard/stats`).then(r => r.json());

    if (statsRes.success) {
      const d = statsRes.data;
      allowMultiDoctor = d.allow_multi_doctor || false;
      allowInsurance = d.allow_insurance || false;
      allowRefunds = d.allow_refunds || false;
      
      const specialty = d.specialty || localStorage.getItem('tenant_specialty') || 'dental';
      window.clinicSpecialty = specialty;
      localStorage.setItem('tenant_specialty', specialty);

      if (d.tenant_name) {
        const brandH3 = document.getElementById('sidebar-clinic-name');
        if (brandH3) brandH3.textContent = d.tenant_name;
        localStorage.setItem('tenant_name', d.tenant_name);
      }

      // Update sidebar specialty subtitle and icon
      const brandSub = document.querySelector('.sidebar-brand-text span');
      const examIcon = document.querySelector('#nav-exam i');
      if (specialty === 'orthopedic') {
        if (brandSub) brandSub.textContent = 'جراحة وعلاج العظام والمفاصل';
        if (examIcon) examIcon.className = 'fa-solid fa-bone';
      } else {
        if (brandSub) brandSub.textContent = 'طب وجراحة الأسنان';
        if (examIcon) examIcon.className = 'fa-solid fa-tooth';
      }
      
      const patBadge = document.getElementById('patients-count-badge');
      if (patBadge) patBadge.textContent = d.total_patients;
      
      const inboxBadge = document.getElementById('inbox-unread-badge');
      if (inboxBadge) {
        if (d.active_conversations > 0) {
          inboxBadge.textContent = d.active_conversations;
          inboxBadge.style.display = 'inline-block';
        } else {
          inboxBadge.style.display = 'none';
        }
      }
    }
  } catch (e) {
    console.error('Failed to load base layout stats:', e);
  }
}

// 3. Load Global resources
async function loadGlobalData() {
  try {
    const [pRes, sRes, whRes, dRes] = await Promise.all([
      authFetch(`${API_BASE}/v1/patients`).then(r => r.json()),
      authFetch(`${API_BASE}/v1/settings/services`).then(r => r.json()),
      authFetch(`${API_BASE}/v1/settings/working-hours`).then(r => r.json()),
      authFetch(`${API_BASE}/v1/doctors`).then(r => r.json())
    ]);
    if (pRes.success) allPatients = pRes.data.patients;
    if (sRes.success) allServices = sRes.data;
    if (whRes.success) workingHoursData = whRes.data;
    if (dRes.success) allDoctors = dRes.data;
  } catch (e) {
    console.error('Failed to load base global data:', e);
  }
}

// --- Common UI Helpers ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
  toast.innerHTML = `
    <div class="toast-icon"><i class="${iconClass}"></i></div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" type="button">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  toast.querySelector('.toast-close').addEventListener('click', () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); });
  setTimeout(() => { if (toast.parentNode) { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); } }, 4000);
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('open');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}
