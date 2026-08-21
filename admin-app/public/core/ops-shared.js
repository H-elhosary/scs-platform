// =============================================
// Smart Clinic OS — OPS CONSOLE shared shell
// Sidebar injection, notification bell, auth fetch wrapper, toast/modal
// helpers — the admin-app equivalent of clinic-app's core/shared.js,
// built the same way so both consoles behave identically.
// =============================================

const API_BASE = '';
const opsToken = sessionStorage.getItem('ops_token');

if (!opsToken) {
  window.location.href = 'index.html';
}

// Decode the operator's name/role out of the JWT payload (display only).
// `rawRole` drives real UI gating (server-side requireAdminRole is the real
// enforcement); `role` is just the display label.
let operatorUser = { full_name: 'مشغل النظام', role: 'Super Admin', rawRole: 'super_admin' };
if (opsToken && opsToken.includes('.')) {
  try {
    const base64Url = opsToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payloadObj = JSON.parse(jsonPayload);
    operatorUser.full_name = payloadObj.full_name || payloadObj.email || operatorUser.full_name;
    operatorUser.rawRole = payloadObj.role || 'admin';
    operatorUser.role = { 
      super_admin: 'Super Admin', 
      admin: 'Operations Admin', 
      support: 'Support Specialist',
      finance: 'Finance Auditor'
    }[operatorUser.rawRole] || 'Admin';
  } catch (e) { console.warn('Failed to parse token payload:', e); }
}

// Wrapper around fetch() that attaches the operator's bearer token to every
// same-origin ops API call, and redirects to login only when the token itself
// is invalid/expired (401). A 403 means a valid, logged-in operator hit a
// route their role isn't permitted to use (e.g. support hitting an
// admin/super_admin-only endpoint) — that's a normal permission error the
// caller should show a message for, not a reason to nuke the whole session.
async function opsFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opsToken}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    sessionStorage.removeItem('ops_token');
    window.location.href = 'index.html';
    throw new Error('Session expired');
  }
  return res;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  injectOpsShell();
  injectOpsNotificationBell();
  document.dispatchEvent(new CustomEvent('opsShellReady'));
});

// 1. Inject sidebar + toast container into `.clinic-layout`
function injectOpsShell() {
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    tc.className = 'toast-container';
    document.body.appendChild(tc);
  }

  const layout = document.querySelector('.clinic-layout');
  if (!layout || document.getElementById('clinic-sidebar')) return;

  const aside = document.createElement('aside');
  aside.className = 'clinic-sidebar';
  aside.id = 'clinic-sidebar';

  const isCollapsed = localStorage.getItem('opsSidebarCollapsed') === 'true';
  if (isCollapsed) aside.classList.add('collapsed');

  aside.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      </div>
      <div class="sidebar-brand-text">
        <h3>Smart Clinic OS</h3>
        <span>Ops Console</span>
      </div>
      <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" onclick="toggleOpsSidebar()" aria-label="Toggle Sidebar">
        <i id="sidebar-toggle-icon" class="fa-solid ${isCollapsed ? 'fa-angle-left' : 'fa-angle-right'}"></i>
      </button>
    </div>

    <nav class="sidebar-nav">
      <a href="admin.html" class="sidebar-link" id="nav-home">
        <i class="fa-solid fa-chart-line"></i>
        <span>الرئيسية</span>
      </a>
      <a href="admin_clinics.html" class="sidebar-link" id="nav-clinics">
        <i class="fa-solid fa-hospital"></i>
        <span>إدارة العيادات</span>
      </a>
      <a href="admin_plans.html" class="sidebar-link" id="nav-plans">
        <i class="fa-solid fa-gem"></i>
        <span>إدارة الباقات</span>
      </a>
      <a href="admin_tickets.html" class="sidebar-link" id="nav-tickets">
        <i class="fa-solid fa-clipboard-list"></i>
        <span>الطلبات والشكاوى</span>
      </a>
      <a href="admin_reports.html" class="sidebar-link" id="nav-reports">
        <i class="fa-solid fa-chart-pie"></i>
        <span>التقارير</span>
      </a>
      <a href="admin_broadcast.html" class="sidebar-link" id="nav-broadcast">
        <i class="fa-solid fa-bullhorn"></i>
        <span>بث جماعي</span>
      </a>
      <a href="admin_operators.html" class="sidebar-link" id="nav-operators" style="display:none;">
        <i class="fa-solid fa-user-shield"></i>
        <span>فريق العمليات</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar"><i class="fa-solid fa-user-gear"></i></div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name" id="operator-name">${escapeHtml(operatorUser.full_name)}</span>
          <span class="sidebar-user-role" id="operator-role">${escapeHtml(operatorUser.role)}</span>
        </div>
      </div>
      <a href="#" class="sidebar-link logout-link" id="logout-btn">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>تسجيل خروج</span>
      </a>
    </div>
  `;

  layout.insertBefore(aside, layout.firstChild);
  highlightOpsActiveLink();

  if (operatorUser.rawRole === 'super_admin') {
    const opsLink = document.getElementById('nav-operators');
    if (opsLink) opsLink.style.display = '';
  }
  if (operatorUser.rawRole === 'support') {
    // Reports and broadcast are admin/super_admin-only server-side too.
    ['nav-reports', 'nav-broadcast'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
  applyRoleBasedUI();

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('ops_token');
    window.location.href = 'index.html';
  });

  // Mobile drawer support (mirrors clinic-app's pattern)
  if (!document.getElementById('sidebar-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.addEventListener('click', closeMobileOpsSidebar);
    document.body.appendChild(backdrop);
  }
  if (!document.getElementById('mobile-menu-btn')) {
    const menuBtn = document.createElement('button');
    menuBtn.id = 'mobile-menu-btn';
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    menuBtn.setAttribute('aria-label', 'فتح القائمة');
    menuBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('clinic-sidebar');
      const isOpen = sidebar.classList.contains('mobile-open');
      isOpen ? closeMobileOpsSidebar() : openMobileOpsSidebar();
    });
    document.body.appendChild(menuBtn);
  }
}

function toggleOpsSidebar() {
  const sidebar = document.getElementById('clinic-sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  const btnIcon = document.getElementById('sidebar-toggle-icon');
  const collapsed = sidebar.classList.contains('collapsed');
  if (btnIcon) btnIcon.className = collapsed ? 'fa-solid fa-angle-left' : 'fa-solid fa-angle-right';
  localStorage.setItem('opsSidebarCollapsed', collapsed ? 'true' : 'false');
}

function openMobileOpsSidebar() {
  document.getElementById('clinic-sidebar')?.classList.add('mobile-open');
  document.getElementById('sidebar-backdrop')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeMobileOpsSidebar() {
  document.getElementById('clinic-sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('active');
  document.body.style.overflow = '';
}

function highlightOpsActiveLink() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'admin.html';
  const activeLinkId = {
    'admin.html': 'nav-home',
    'admin_clinics.html': 'nav-clinics',
    'admin_plans.html': 'nav-plans',
    'admin_tickets.html': 'nav-tickets',
    'clinic_details.html': 'nav-clinics',
    'admin_reports.html': 'nav-reports',
    'admin_broadcast.html': 'nav-broadcast',
    'admin_operators.html': 'nav-operators'
  }[filename] || 'nav-home';
  document.getElementById(activeLinkId)?.classList.add('active');
}

// Hides mutate-only controls for the `support` role, and blocks a non-super_admin
// from staying on the super_admin-only operators page if they land on it directly.
// Defense-in-depth only — the server's requireAdminRole checks are the real enforcement.
function applyRoleBasedUI() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1) || 'admin.html';

  if (filename === 'admin_operators.html' && operatorUser.rawRole !== 'super_admin') {
    window.location.href = 'admin.html';
    return;
  }
  if (['admin_reports.html', 'admin_broadcast.html'].includes(filename) && operatorUser.rawRole === 'support') {
    window.location.href = 'admin.html';
    return;
  }

  if (operatorUser.rawRole === 'support') {
    const idsToHide = [
      'add-clinic-btn', 'btn-add-new-plan', 'plan-config-delete-btn',
      'det-delete-btn', 'det-toggle-status-btn', 'det-reset-pwd-btn',
      'det-add-doc-btn', 'det-save-btn'
    ];
    idsToHide.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
}

// 2. Notification bell — surfaces pending support tickets as ops notifications
function injectOpsNotificationBell() {
  const headerActions = document.querySelector('.view-header-actions');
  if (!headerActions || document.getElementById('notification-bell-container')) return;

  const bellWrap = document.createElement('div');
  bellWrap.id = 'notification-bell-container';
  bellWrap.className = 'notification-bell-wrapper';
  bellWrap.innerHTML = `
    <button class="notification-bell-btn" id="notification-bell-btn" onclick="toggleOpsNotificationDropdown(event)" aria-label="إشعارات العمليات" title="إشعارات وتنبيهات العمليات">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
      </svg>
      <span class="notification-badge" id="notification-badge" style="display:none;">0</span>
    </button>
    <div class="notification-dropdown" id="notification-dropdown">
      <div class="notification-dropdown-header">
        <h4 class="notification-dropdown-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
          </svg>
          تنبيهات العمليات والطلبات
        </h4>
        <button class="notification-mark-all-btn" onclick="loadOpsNotifications()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          تحديث
        </button>
      </div>
      <div class="notification-dropdown-body" id="notification-dropdown-body">
        <div class="notification-empty-state"><div class="notification-empty-title">جاري التحميل...</div></div>
      </div>
    </div>
  `;
  headerActions.insertBefore(bellWrap, headerActions.firstChild);

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notification-dropdown');
    const btn = document.getElementById('notification-bell-btn');
    if (dropdown && dropdown.classList.contains('active') && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  loadOpsNotifications();
}

function toggleOpsNotificationDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle('active');
  if (isOpen) loadOpsNotifications();
}

async function loadOpsNotifications() {
  try {
    const res = await opsFetch(`${API_BASE}/admin/v1/tickets`).then(r => r.json());
    if (!res.success) return;

    const tickets = res.data || [];
    const pending = tickets.filter(t => t.status === 'pending');

    const badge = document.getElementById('notification-badge');
    if (badge) {
      if (pending.length > 0) { badge.textContent = pending.length; badge.style.display = 'flex'; }
      else { badge.style.display = 'none'; }
    }

    const bodyEl = document.getElementById('notification-dropdown-body');
    if (!bodyEl) return;

    if (tickets.length === 0) {
      bodyEl.innerHTML = `<div class="notification-empty-state"><div class="notification-empty-title">لا توجد تذاكر أو طلبات حالية</div></div>`;
      return;
    }

    bodyEl.innerHTML = tickets.slice(0, 8).map(t => {
      const timeStr = t.created_at ? new Date(t.created_at).toLocaleDateString('ar-EG') : '';
      return `
        <div class="notification-item" onclick="location.href='admin_tickets.html'">
          <div class="notification-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="notification-content">
            <div class="notification-item-title">${escapeHtml(t.tenant_name || 'عيادة')} — ${escapeHtml(t.type_ar || t.type)}</div>
            <div class="notification-item-msg">${escapeHtml(t.title)}</div>
            <div class="notification-item-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${timeStr}</span>
              ${t.status === 'pending' ? '<span style="color:var(--scs-danger); font-weight:bold; margin-right:6px;">(قيد الانتظار)</span>' : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.warn('Failed to load ops notifications:', err);
  }
}

// 3. Shared UI helpers
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

function openModal(modalId) { document.getElementById(modalId)?.classList.add('open'); }
function closeModal(modalId) { document.getElementById(modalId)?.classList.remove('open'); }

// Generates and downloads a CSV file from already-fetched table data.
// BOM prefix keeps Excel from mangling Arabic text.
function exportTableToCSV(filename, headers, rows) {
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showLoading(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = true;
  btn.querySelector('.btn-text')?.classList.add('hide');
  btn.querySelector('.spinner')?.classList.remove('hide');
}
function hideLoading(btnId, restoreText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = false;
  const textEl = btn.querySelector('.btn-text');
  if (textEl) { textEl.classList.remove('hide'); if (restoreText) textEl.innerText = restoreText; }
  btn.querySelector('.spinner')?.classList.add('hide');
}
