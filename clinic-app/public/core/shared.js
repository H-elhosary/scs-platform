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

// Escape untrusted text (e.g. patient-supplied names from WhatsApp/Telegram
// profiles) before interpolating it into innerHTML.
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
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
  injectNotificationBell();
  await loadBaseLayoutData();
  await loadGlobalData();
  await loadInAppNotifications();
  
  // Custom event trigger so page scripts know shared data is ready
  document.dispatchEvent(new CustomEvent('sharedDataReady'));

  // Periodic background check for new notifications
  setInterval(loadInAppNotifications, 25000);
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

// =============================================
// In-App Notification Bell & UI System (Strictly SVG - No Emojis)
// =============================================

function injectNotificationBell() {
  if (document.getElementById('notification-bell-container')) return;

  const headerActions = document.querySelector('.view-header-actions') || 
                        document.querySelector('.top-header-actions') || 
                        document.querySelector('.view-header');

  if (!headerActions) return;

  const bellWrap = document.createElement('div');
  bellWrap.id = 'notification-bell-container';
  bellWrap.className = 'notification-bell-wrapper';

  bellWrap.innerHTML = `
    <button class="notification-bell-btn" id="notification-bell-btn" onclick="toggleNotificationDropdown(event)" aria-label="الإشعارات" title="الإشعارات">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
      </svg>
      <span class="notification-badge" id="notification-badge" style="display: none;">0</span>
    </button>

    <div class="notification-dropdown" id="notification-dropdown">
      <div class="notification-dropdown-header">
        <h4 class="notification-dropdown-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
          </svg>
          الإشعارات والتنبيهات
        </h4>
        <button class="notification-mark-all-btn" id="notif-mark-all-btn" onclick="markAllNotificationsAsRead(event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          تحديد الكل كمقروء
        </button>
      </div>

      <div class="notification-dropdown-body" id="notification-dropdown-body">
        <div class="notification-empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"></path>
            <path d="M17 17H3s3-2 3-9a6 6 0 0 1 .4-2"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
          <div class="notification-empty-title">لا توجد إشعارات جديدة</div>
          <div class="notification-empty-desc">ستظهر هنا أي تنبيهات أو حجوزات قادمة</div>
        </div>
      </div>
    </div>
  `;

  // Prepend to header actions so it sits nicely next to the action button
  headerActions.insertBefore(bellWrap, headerActions.firstChild);

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notification-dropdown');
    const btn = document.getElementById('notification-bell-btn');
    if (dropdown && dropdown.classList.contains('active')) {
      if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    }
  });
}

function toggleNotificationDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains('active');
  if (isOpen) {
    dropdown.classList.remove('active');
  } else {
    dropdown.classList.add('active');
    loadInAppNotifications();
  }
}

// Pure SVG Icon Provider for Notification Types (Strictly NO Emojis)
function getNotificationSvgIcon(type = 'info') {
  switch (type) {
    case 'booking':
      return `
        <div class="notification-icon-box booking">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <path d="m9 16 2 2 4-4"></path>
          </svg>
        </div>
      `;
    case 'success':
      return `
        <div class="notification-icon-box success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
      `;
    case 'warning':
      return `
        <div class="notification-icon-box warning">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
      `;
    case 'info':
    default:
      return `
        <div class="notification-icon-box info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
      `;
  }
}

async function loadInAppNotifications() {
  try {
    const res = await authFetch(`${API_BASE}/v1/notifications`).then(r => r.json());
    if (!res.success) return;

    const notifications = res.data.notifications || [];
    const unreadCount = res.data.unread_count || 0;

    // Update Badge
    const badge = document.getElementById('notification-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Render Dropdown List
    const bodyEl = document.getElementById('notification-dropdown-body');
    if (!bodyEl) return;

    if (notifications.length === 0) {
      bodyEl.innerHTML = `
        <div class="notification-empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"></path>
            <path d="M17 17H3s3-2 3-9a6 6 0 0 1 .4-2"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
          <div class="notification-empty-title">لا توجد إشعارات جديدة</div>
          <div class="notification-empty-desc">ستظهر هنا أي تنبيهات أو حجوزات قادمة</div>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = notifications.map(n => {
      const isUnread = !n.is_read;
      const iconSvg = getNotificationSvgIcon(n.type);
      const timeStr = n.created_at ? new Date(n.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
      const dateStr = n.created_at ? new Date(n.created_at).toLocaleDateString('ar-EG') : '';

      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}', '${n.link || ''}')">
          ${iconSvg}
          <div class="notification-content">
            <div class="notification-item-title">${escapeHtml(n.title)}</div>
            <div class="notification-item-msg">${escapeHtml(n.message)}</div>
            <div class="notification-item-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${dateStr} - ${timeStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn('Failed to load in-app notifications:', err);
  }
}

async function handleNotificationClick(id, link) {
  try {
    await authFetch(`${API_BASE}/v1/notifications/${id}/read`, { method: 'PUT' });
    await loadInAppNotifications();
    if (link && link !== 'null' && link !== '') {
      window.location.href = link;
    }
  } catch (err) {
    console.error('Error marking notification as read:', err);
  }
}

async function markAllNotificationsAsRead(e) {
  if (e) e.stopPropagation();
  try {
    await authFetch(`${API_BASE}/v1/notifications/read-all`, { method: 'PUT' });
    await loadInAppNotifications();
    showToast('تم تحديد جميع الإشعارات كمقروءة', 'success');
  } catch (err) {
    console.error('Error marking all notifications read:', err);
  }
}
