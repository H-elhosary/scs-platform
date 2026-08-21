// ==========================================
// Smart Clinic OS (SCS) — Ops Console Controller
// Powers admin.html (home), admin_clinics.html, admin_plans.html.
// Auth, session decoding, sidebar, notification bell and toast/modal
// helpers all come from core/ops-shared.js, loaded before this file.
// ==========================================

let allTenants = [];
let allPlans = [];

const alertPanel = document.getElementById('alert-panel');
const alertMsg = document.getElementById('alert-msg');
function showAlert(message) { if (alertMsg && alertPanel) { alertMsg.innerText = message; alertPanel.classList.remove('hide'); } }
function hideAlert() { if (alertPanel) alertPanel.classList.add('hide'); }

// Which page are we on?
const onHome = !!document.getElementById('kpi-total-clinics');
const onClinics = !!document.getElementById('clinics-table-body');
const onPlans = !!document.getElementById('ops-plans-cards-container');

document.addEventListener('opsShellReady', () => {
  if (onHome) {
    setupHeaderGreeting();
    loadDashboardStats();

    // Audit log is admin/super_admin-only server-side
    if (operatorUser.rawRole === 'support') {
      document.getElementById('btn-view-all-audits')?.style.setProperty('display', 'none');
    }
  }
  if (onClinics) { loadClinicsList(); }
  if (onPlans) { loadPlansTab(); }
  if (document.getElementById('clinic-plan')) { loadPlansForOnboardSelect(); }
});

// =============================================
// HOME — Header greeting (compact, matches every other page's .view-header)
// =============================================
function setupHeaderGreeting() {
  const greetingEl = document.getElementById('header-greeting-text');
  const nameEl = document.getElementById('header-operator-name');
  const descEl = document.getElementById('header-role-desc');

  const curHour = new Date().getHours();
  const timeGreeting = curHour < 12 ? 'صباح الخير،' : 'مساء الخير،';

  if (greetingEl) greetingEl.innerText = timeGreeting;
  if (nameEl) nameEl.innerText = operatorUser.full_name || 'مشغل النظام';

  const role = operatorUser.rawRole || 'admin';
  const roleDesc = {
    super_admin: 'صلاحيات كاملة على العيادات، الاشتراكات، الباقات، وفريق العمليات.',
    admin: 'متابعة العيادات، الاشتراكات، وتذاكر الدعم.',
    support: 'الرد على تذاكر الدعم والوصول لبيانات العيادات.'
  }[role] || '';
  if (descEl) descEl.innerText = roleDesc;
}

// =============================================
// HOME — KPIs, reports, and recent clinics
// =============================================
async function loadDashboardStats() {
  try {
    const [tenantsRes, ticketsRes] = await Promise.all([
      opsFetch('/admin/v1/tenants'),
      opsFetch('/admin/v1/tickets').catch(() => null)
    ]);
    const data = await tenantsRes.json();
    if (!data.success) { showAlert(data.error.message); return; }

    const stats = data.data.stats;
    const tenants = data.data.tenants || [];
    allTenants = tenants;

    let tickets = [];
    if (ticketsRes) {
      const ticketsData = await ticketsRes.json().catch(() => null);
      if (ticketsData?.success) tickets = ticketsData.data || [];
    }
    const pendingTickets = tickets.filter(t => t.status === 'pending');
    const now = new Date();
    const overdueTickets = tickets.filter(t => t.due_at && new Date(t.due_at) < now && ['pending', 'processing'].includes(t.status));

    document.getElementById('kpi-total-clinics').innerText = stats.total_clinics || tenants.length;
    document.getElementById('kpi-active-clinics').innerText = stats.active_clinics || tenants.filter(t => t.status === 'active').length;
    document.getElementById('kpi-suspended-clinics').innerText = stats.suspended_clinics || tenants.filter(t => t.status === 'suspended').length || 0;

    // Fourth Card Customization based on Role
    const role = operatorUser.rawRole || 'admin';
    const fourthLabel = document.getElementById('kpi-fourth-label');
    const fourthVal = document.getElementById('kpi-fourth-value');
    const fourthTrend = document.getElementById('kpi-fourth-trend');
    const fourthIcon = document.getElementById('kpi-fourth-icon');

    if (role === 'support') {
      if (fourthLabel) fourthLabel.innerText = 'تذاكر الدعم والطلبات';
      if (fourthVal) fourthVal.innerText = `${pendingTickets.length} معلقة`;
      if (fourthTrend) fourthTrend.innerHTML = overdueTickets.length > 0
        ? `<i class="fa-solid fa-triangle-exclamation"></i> ${overdueTickets.length} متأخرة عن الحد الزمني`
        : '<i class="fa-solid fa-circle-check"></i> لا توجد تذاكر متأخرة';
      if (fourthIcon) {
        fourthIcon.innerHTML = '<i class="fa-solid fa-headset"></i>';
        fourthIcon.style.background = 'var(--scs-warning-glow)';
        fourthIcon.style.color = 'var(--scs-warning)';
      }
    } else {
      if (fourthLabel) fourthLabel.innerText = 'الدخل المتكرر (MRR)';
      if (fourthVal) fourthVal.innerText = `$${stats.estimated_mrr || 0}`;
    }

    renderNeedsAttention(role, overdueTickets.length, stats.pending_expiry || 0);

    // Render Recent Clinics Table
    renderRecentClinicsSnapshot(tenants);

  } catch (error) {
    console.error('loadDashboardStats error:', error);
    showAlert('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً');
  }
}

// =============================================
// HOME — Needs-Attention panel (real, actionable data only:
// SLA-overdue tickets + clinics expiring within 30 days — both were
// already computed/tracked server-side but never surfaced anywhere).
// Only takes screen space for things that are actually wrong: a single
// slim "all clear" line on a normal day, one card per real problem
// otherwise — never a mix of green and red cards side by side.
// =============================================
function renderNeedsAttention(role, overdueTicketsCount, expiringSoonCount) {
  const container = document.getElementById('attention-grid');
  if (!container) return;

  const cards = [];

  if (overdueTicketsCount > 0) {
    cards.push({
      href: 'admin_tickets.html',
      icon: 'fa-solid fa-stopwatch',
      title: `${overdueTicketsCount} تذكرة متأخرة عن SLA`,
      desc: 'تحتاج رد فوري من فريق الدعم',
      level: 'danger'
    });
  }

  if (role !== 'support' && expiringSoonCount > 0) {
    cards.push({
      href: 'admin_clinics.html',
      icon: 'fa-solid fa-calendar-days',
      title: `${expiringSoonCount} عيادة تنتهي خلال 30 يوماً`,
      desc: 'راجع التجديد قبل انتهاء الاشتراك',
      level: 'warn'
    });
  }

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="attention-allclear">
        <i class="fa-solid fa-circle-check"></i>
        <span>لا توجد إجراءات عاجلة الآن — كل شيء تحت السيطرة</span>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="attention-grid-inner">${cards.map(c => `
    <a href="${c.href}" class="attention-card attention-${c.level}">
      <div class="attention-icon"><i class="${c.icon}"></i></div>
      <div class="attention-text">
        <strong>${c.title}</strong>
        <span>${c.desc}</span>
      </div>
      <i class="fa-solid fa-arrow-left attention-arrow"></i>
    </a>
  `).join('')}</div>`;
}

// =============================================
// HOME — Recent Clinics Snapshot & Search
// =============================================
function renderRecentClinicsSnapshot(tenants) {
  const tbody = document.getElementById('home-clinics-body');
  if (!tbody) return;

  if (tenants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:24px; color:var(--scs-text-muted);">لا توجد عيادات مسجلة بعد.</td></tr>';
    return;
  }

  const specialtyMap = {
    dental: 'طب أسنان',
    orthopedic: 'عظام ومفاصل',
    dermatology: 'جلدية وتجميل',
    derma: 'جلدية وتجميل',
    pediatric: 'أطفال',
    general: 'ممارس عام'
  };

  const renderRows = (list) => {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:20px; color:var(--scs-text-muted);">لا توجد نتائج مطابقة للبحث.</td></tr>';
      return;
    }
    tbody.innerHTML = list.slice(0, 6).map(t => {
      const specAr = specialtyMap[t.specialty] || t.specialty || 'عام';
      const isSuspended = t.status === 'suspended';
      const statusBadge = isSuspended 
        ? '<span class="status-suspended-badge" style="font-size:11px; padding:3px 8px;"><i class="fa-solid fa-circle-pause"></i> معلق</span>'
        : '<span class="status-active-badge" style="font-size:11px; padding:3px 8px;"><i class="fa-solid fa-circle-check"></i> نشط</span>';
      
      const planClass = `plan-${t.subscription_plan || 'basic'}`;

      return `
        <tr>
          <td>
            <strong style="color:var(--scs-text-heading); font-size:13px;">${escapeHtml(t.name)}</strong>
            <br><small style="color:var(--scs-text-dim); font-size:10.5px;">/${escapeHtml(t.slug || '')}</small>
          </td>
          <td><span class="specialty-label" style="font-size:11px;">${escapeHtml(specAr)}</span></td>
          <td><span class="plan-badge ${planClass}" style="font-size:10.5px; font-weight:800;">${escapeHtml((t.subscription_plan || 'BASIC').toUpperCase())}</span></td>
          <td>${statusBadge}</td>
          <td>
            <a href="clinic_details.html?id=${t.id}" class="btn-outline-cta" style="font-size:11px; padding:4px 9px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-gear"></i> <span>إدارة</span>
            </a>
          </td>
        </tr>
      `;
    }).join('');
  };

  renderRows(tenants);

  // Search filter event
  const searchInput = document.getElementById('quick-clinic-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderRows(tenants);
        return;
      }
      const filtered = tenants.filter(t => 
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.slug && t.slug.toLowerCase().includes(q)) ||
        (t.specialty && t.specialty.toLowerCase().includes(q)) ||
        (t.owner_email && t.owner_email.toLowerCase().includes(q))
      );
      renderRows(filtered);
    });
  }
}

function actionLabelFor(action) {
  const map = {
    'tenant.create': 'إنشاء عيادة', 'tenant.deactivate': 'تعليق حساب', 'tenant.activate': 'تنشيط حساب',
    'tenant.update': 'تعديل عيادة', 'tenant.update_features': 'تعديل صلاحيات', 'tenant.delete': 'حذف عيادة',
    'tenant.add_doctor': 'إضافة طبيب', 'subscription.change': 'تعديل اشتراك', 'user.password_reset': 'إعادة كلمة مرور',
    'plan.update_config': 'تعديل باقة', 'ticket.update': 'تحديث طلب', 'doctor.reset_password': 'إعادة تعيين كلمة المرور'
  };
  return map[action] || action;
}
function actionBadgeClassFor(action) {
  if (['tenant.create', 'tenant.activate'].includes(action)) return 'plan-badge plan-pro';
  if (['tenant.update', 'tenant.update_features', 'subscription.change', 'user.password_reset', 'plan.update_config', 'doctor.reset_password'].includes(action)) return 'plan-badge plan-enterprise';
  return 'plan-badge plan-basic';
}

// Audit modal (opened on demand via the "سجل العمليات" button)
async function openAuditLogsModal() {
  const tableBody = document.getElementById('audit-logs-table-body');
  tableBody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:16px;">جاري تحميل سجل العمليات...</td></tr>';
  openModal('audit-logs-modal');
  try {
    const res = await opsFetch('/admin/v1/audit-logs');
    const data = await res.json();
    if (!data.success) { showToast(data.error.message, 'error'); return; }
    if (data.data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:16px; color:var(--scs-text-muted);">لا توجد عمليات مسجلة حالياً.</td></tr>';
      return;
    }
    tableBody.innerHTML = data.data.map(log => `
      <tr>
        <td><strong>${escapeHtml(log.operator_name)}</strong><br><small style="color:var(--scs-text-dim); font-size:10px;">ID: ${escapeHtml((log.admin_id || '').substring(0, 8))}</small></td>
        <td><span class="${actionBadgeClassFor(log.action)}" style="font-size:11px;">${actionLabelFor(log.action)}</span></td>
        <td><span class="specialty-label" style="font-size:11px;">${escapeHtml((log.target_type || '').toUpperCase())}</span><br><small style="color:var(--scs-text-dim); font-size:10px;">ID: ${log.target_id ? escapeHtml(log.target_id.substring(0, 8)) : '—'}</small></td>
        <td><span class="audit-details-code" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details || '—')}</span></td>
        <td><code>${escapeHtml(log.ip_address || '—')}</code></td>
        <td><small>${new Date(log.created_at).toLocaleString('ar-EG')}</small></td>
      </tr>`).join('');
  } catch (error) {
    showToast('فشل الاتصال بالخادم', 'error');
  }
}
document.getElementById('btn-quick-view-audit')?.addEventListener('click', openAuditLogsModal);
document.getElementById('btn-view-all-audits')?.addEventListener('click', openAuditLogsModal);
document.getElementById('audit-close-btn')?.addEventListener('click', () => closeModal('audit-logs-modal'));
document.getElementById('audit-done-btn')?.addEventListener('click', () => closeModal('audit-logs-modal'));

document.getElementById('export-audit-csv-btn')?.addEventListener('click', async () => {
  try {
    // Fresh, uncapped fetch — the modal's own table is capped at 100 rows.
    const res = await opsFetch('/admin/v1/audit-logs?limit=5000');
    const data = await res.json();
    if (!data.success) { showToast(data.error?.message || 'فشل تصدير السجل', 'error'); return; }
    const headers = ['المشغل', 'الإجراء', 'النوع المستهدف', 'التفاصيل', 'IP', 'التاريخ'];
    const rows = data.data.map(log => [
      log.operator_name, actionLabelFor(log.action), log.target_type || '', log.details || '', log.ip_address || '', log.created_at || ''
    ]);
    exportTableToCSV(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  } catch (error) {
    showToast('فشل الاتصال بالخادم أثناء تصدير السجل', 'error');
  }
});

document.getElementById('export-audit-csv-btn')?.addEventListener('click', async () => {
  try {
    // Fresh, uncapped fetch — the modal's own table is capped at 100 rows.
    const res = await opsFetch('/admin/v1/audit-logs?limit=5000');
    const data = await res.json();
    if (!data.success) { showToast(data.error?.message || 'فشل تصدير السجل', 'error'); return; }
    const headers = ['المشغل', 'الإجراء', 'النوع المستهدف', 'التفاصيل', 'IP', 'التاريخ'];
    const rows = data.data.map(log => [
      log.operator_name, actionLabelFor(log.action), log.target_type || '', log.details || '', log.ip_address || '', log.created_at || ''
    ]);
    exportTableToCSV(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  } catch (error) {
    showToast('فشل الاتصال بالخادم أثناء تصدير السجل', 'error');
  }
});

// =============================================
// CLINICS LIST — table, filters, onboarding
// =============================================
async function loadClinicsList() {
  try {
    const res = await opsFetch('/admin/v1/tenants');
    const data = await res.json();
    if (!data.success) { showAlert(data.error.message); return; }
    allTenants = data.data.tenants;
    applyTableFilters();

    // Auto-open onboarding modal if arrived via a "quick action" link
    if (new URLSearchParams(window.location.search).get('action') === 'add') {
      openAddClinicModal();
    }
  } catch (error) {
    console.error('loadClinicsList error:', error);
    showAlert('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً');
  }
}

function applyTableFilters() {
  const query = (document.getElementById('table-search-input').value || '').toLowerCase().trim();
  const plan = document.getElementById('filter-plan').value;
  const status = document.getElementById('filter-status').value;

  const filtered = allTenants.filter(t => {
    const doctorName = (t.doctor?.name || t.owner_name || '').toLowerCase();
    const matchesSearch = !query ||
      (t.name || '').toLowerCase().includes(query) ||
      (t.slug || '').toLowerCase().includes(query) ||
      (t.specialty || '').toLowerCase().includes(query) ||
      doctorName.includes(query);

    const matchesPlan = plan === 'all' || (t.subscription_plan || '').toLowerCase() === plan;

    const isExpired = new Date(t.expires_at) <= new Date();
    let matchesStatus = true;
    if (status === 'active') matchesStatus = t.status === 'active' && !isExpired;
    else if (status === 'suspended') matchesStatus = t.status === 'suspended';
    else if (status === 'expired') matchesStatus = t.status === 'active' && isExpired;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  renderClinicsTable(filtered);
}
document.getElementById('table-search-input')?.addEventListener('input', applyTableFilters);
document.getElementById('filter-plan')?.addEventListener('change', applyTableFilters);
document.getElementById('filter-status')?.addEventListener('change', applyTableFilters);

document.getElementById('export-clinics-csv-btn')?.addEventListener('click', () => {
  const headers = ['الاسم', 'الرابط', 'التخصص', 'الباقة', 'الحالة', 'تاريخ الانتهاء', 'بريد المالك'];
  const rows = allTenants.map(t => [
    t.name, t.slug, t.specialty || '', t.subscription_plan || '', t.status || '', t.expires_at || '', t.owner_email || ''
  ]);
  exportTableToCSV(`clinics-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
});

function renderClinicsTable(tenants) {
  const tableBody = document.getElementById('clinics-table-body');
  if (tenants.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:24px; color:var(--scs-text-muted);">لا توجد عيادات مطابقة للفلاتر الحالية.</td></tr>';
    return;
  }

  tableBody.innerHTML = tenants.map(tenant => {
    const now = new Date();
    const expiry = new Date(tenant.expires_at);
    const isExpired = expiry <= now;

    let statusBadge;
    if (tenant.status === 'suspended') statusBadge = `<span class="status-suspended-badge"><i class="fa-solid fa-circle-pause"></i> معلق</span>`;
    else if (isExpired) statusBadge = `<span class="status-suspended-badge"><i class="fa-solid fa-circle-exclamation"></i> منتهي</span>`;
    else statusBadge = `<span class="status-active-badge"><i class="fa-solid fa-circle-check"></i> نشط</span>`;

    const expiryDate = expiry.toLocaleDateString('ar-EG');
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let expiryClass = '';
    if (expiry <= now) expiryClass = 'expiry-warning expired';
    else if (expiry <= thirtyDays) expiryClass = 'expiry-warning soon';
    const expiryCell = expiryClass ? `<span class="${expiryClass}">${expiryDate}</span>` : expiryDate;

    const planClass = `plan-badge plan-${(tenant.subscription_plan || 'basic').toLowerCase()}`;

    let flagsHtml = '<div style="margin-top:6px; display:flex; gap:4px;">';
    if (tenant.allow_multi_doctor) flagsHtml += `<span class="flag-badge-pill" style="background:#f5f3ff; color:var(--scs-purple); border-color:#ddd6fe;" title="أطباء متعددون">MD</span>`;
    if (tenant.allow_insurance) flagsHtml += `<span class="flag-badge-pill" style="background:var(--scs-primary-glow); color:var(--scs-primary); border-color:var(--scs-primary-border);" title="تأمين طبي">IN</span>`;
    if (tenant.allow_refunds) flagsHtml += `<span class="flag-badge-pill" style="background:var(--scs-success-glow); color:var(--scs-success); border-color:#a7f3d0;" title="استرداد تلقائي">RF</span>`;
    flagsHtml += '</div>';

    const doctorName = tenant.doctor?.name || tenant.owner_name || '—';

    return `
      <tr>
        <td>
          <div style="cursor:pointer; font-weight:700; color:var(--primary);" onclick="openClinicDetails('${tenant.id}')" title="اضغط لفتح إدارة التفاصيل">${escapeHtml(tenant.name)}</div>
          <div style="font-size:12px; color:var(--scs-text-muted); margin-top:3px;"><i class="fa-solid fa-user-doctor" style="color:var(--scs-purple); font-size:11px;"></i> ${escapeHtml(doctorName)}</div>
          ${flagsHtml}
        </td>
        <td><code>${escapeHtml(tenant.slug)}</code></td>
        <td><span class="specialty-label">${escapeHtml(tenant.specialty || 'General')}</span></td>
        <td><span class="${planClass}">${(tenant.subscription_plan || '').toUpperCase()}</span></td>
        <td>
          <div style="font-size:12.5px;">${escapeHtml(tenant.owner_email || '—')}</div>
          <div style="font-size:11.5px; color:var(--scs-text-muted);">${escapeHtml(tenant.owner_phone || '—')}</div>
        </td>
        <td>${expiryCell}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;">
          <button class="btn-outline-cta" style="padding:6px 12px; font-size:11.5px;" title="إدارة تفاصيل العيادة" onclick="openClinicDetails('${tenant.id}')"><i class="fa-solid fa-gears"></i> إدارة</button>
        </td>
      </tr>`;
  }).join('');
}

window.openClinicDetails = (id) => { window.location.href = `clinic_details.html?id=${id}`; };

// --- Onboard new clinic modal ---
function openAddClinicModal() {
  hideAlert();
  document.getElementById('add-clinic-form').reset();
  const today = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(today.getFullYear() + 1);
  document.getElementById('subscription-start-date').value = today.toISOString().split('T')[0];
  document.getElementById('subscription-end-date').value = nextYear.toISOString().split('T')[0];
  openModal('add-clinic-modal');
}
document.getElementById('add-clinic-btn')?.addEventListener('click', openAddClinicModal);
document.getElementById('modal-close-btn')?.addEventListener('click', () => closeModal('add-clinic-modal'));
document.getElementById('modal-cancel-btn')?.addEventListener('click', () => closeModal('add-clinic-modal'));

document.getElementById('add-clinic-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  showLoading('onboard-submit-btn');

  const payload = {
    name: document.getElementById('clinic-name').value,
    slug: document.getElementById('clinic-slug').value,
    specialty: document.getElementById('clinic-specialty').value,
    subscription_plan: document.getElementById('clinic-plan').value,
    subscription_start_date: document.getElementById('subscription-start-date').value,
    subscription_expires_at: document.getElementById('subscription-end-date').value,
    email: document.getElementById('owner-email').value,
    phone: document.getElementById('owner-phone').value
  };

  try {
    const res = await opsFetch('/admin/v1/tenants', { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    hideLoading('onboard-submit-btn', 'إنشاء العيادة وتفعيلها');

    if (data.success) {
      closeModal('add-clinic-modal');
      document.getElementById('activation-link-input').value = data.data.activation_link || '';
      document.getElementById('activation-password-input').value = data.data.temporary_password || '';
      openModal('success-modal');
      loadClinicsList();
    } else {
      showAlert(data.error.message);
    }
  } catch (error) {
    hideLoading('onboard-submit-btn', 'إنشاء العيادة وتفعيلها');
    showAlert('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً');
  }
});

document.getElementById('success-close-btn')?.addEventListener('click', () => closeModal('success-modal'));
document.getElementById('success-done-btn')?.addEventListener('click', () => closeModal('success-modal'));
document.getElementById('copy-link-btn')?.addEventListener('click', () => {
  const input = document.getElementById('activation-link-input');
  navigator.clipboard.writeText(input.value);
  const btn = document.getElementById('copy-link-btn');
  const original = btn.innerText;
  btn.innerText = 'تم النسخ! ✓';
  setTimeout(() => { btn.innerText = original; }, 2000);
});

async function loadPlansForOnboardSelect() {
  const select = document.getElementById('clinic-plan');
  try {
    const res = await opsFetch('/admin/v1/plans');
    const data = await res.json();
    if (data.success) {
      allPlans = data.data;
      select.innerHTML = allPlans.map(p => `<option value="${p.id}">${escapeHtml(p.name)} ($${p.price_usd}/m)</option>`).join('');
      updateOnboardPlanPreview();
    }
  } catch (e) { /* non-fatal — onboarding still works without the preview */ }
}
document.getElementById('clinic-plan')?.addEventListener('change', updateOnboardPlanPreview);
function updateOnboardPlanPreview() {
  const select = document.getElementById('clinic-plan');
  const previewDiv = document.getElementById('plan-features-preview');
  if (!select || !previewDiv) return;
  const plan = allPlans.find(p => p.id === select.value);
  if (!plan) { previewDiv.style.display = 'none'; return; }
  const feats = [];
  if (plan.allow_multi_doctor) feats.push('أطباء متعددون');
  if (plan.allow_insurance) feats.push('تأمين طبي');
  if (plan.allow_refunds) feats.push('استرداد تلقائي');
  if (plan.allow_whatsapp) feats.push('تنبيهات واتساب');
  if (plan.allow_telegram) feats.push('بوت تليجرام');
  if (plan.allow_analytics) feats.push('تحليلات وتقارير');
  if (plan.allow_voice_bot) feats.push('حجز صوتي ذكي');
  if (plan.allow_custom_branding) feats.push('هوية مخصصة');
  previewDiv.style.display = 'block';
  previewDiv.innerHTML = `<strong>صلاحيات الباقة المختارة:</strong> ${feats.join(' — ') || 'لا توجد خصائص إضافية'}`;
}

// =============================================
// PLANS PAGE — configuration cards + sidebar form
// =============================================
async function loadPlansTab() {
  const container = document.getElementById('ops-plans-cards-container');
  try {
    const res = await opsFetch('/admin/v1/plans');
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message);
    allPlans = data.data;

    container.innerHTML = allPlans.map(plan => {
      const badgeClass = plan.id === 'enterprise' ? 'plan-enterprise' : (plan.id === 'pro' ? 'plan-pro' : 'plan-basic');
      const featRow = (label, on) => `<li><span>${label}</span> ${on ? '<i class="fa-solid fa-circle-check" style="color:var(--scs-success);"></i>' : '<i class="fa-solid fa-circle-xmark" style="color:var(--scs-danger);"></i>'}</li>`;
      return `
        <div class="plan-config-card" data-plan-id="${plan.id}">
          <div>
            <div class="plan-config-header" onclick="window.toggleCardFeatures('${plan.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding-bottom:8px;">
              <span class="plan-config-title"><i class="fa-solid fa-gem" style="color:var(--primary);"></i> ${escapeHtml(plan.name)}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="plan-badge ${badgeClass}">${plan.id.toUpperCase()}</span>
                <i class="fa-solid fa-chevron-down" id="chevron-${plan.id}" style="font-size:11px; color:var(--scs-text-muted); transition:transform .2s ease;"></i>
              </div>
            </div>
            <div class="plan-config-price-box">
              <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; color:var(--scs-text-heading); margin-bottom:4px;"><span>السعر بالدولار:</span><span>$${plan.price_usd}/شهر</span></div>
              <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; color:var(--scs-text-heading);"><span>السعر بالجنيه:</span><span>${plan.price_egp} EGP/شهر</span></div>
            </div>
            <ul class="plan-config-features-list hide" id="features-list-${plan.id}">
              ${featRow('أطباء متعددون', plan.allow_multi_doctor)}
              ${featRow('التأمين الطبي', plan.allow_insurance)}
              ${featRow('الاسترداد التلقائي', plan.allow_refunds)}
              ${featRow('تنبيهات واتساب', plan.allow_whatsapp)}
              ${featRow('بوت تليجرام', plan.allow_telegram)}
              ${featRow('تقارير تحليلات', plan.allow_analytics)}
              ${featRow('حجز صوتي ذكي', plan.allow_voice_bot)}
              ${featRow('هوية مخصصة', plan.allow_custom_branding)}
            </ul>
          </div>
          <button type="button" class="btn-outline-cta" onclick="editPlanConfig('${plan.id}')" style="margin-top:14px; width:100%; justify-content:center;"><i class="fa-solid fa-pen-to-square"></i> تعديل خصائص الباقة</button>
        </div>`;
    }).join('');
  } catch (error) {
    container.innerHTML = '<div class="text-center" style="grid-column:1/-1; padding:40px; color:var(--scs-danger);">فشل الاتصال بالخادم لجلب الباقات</div>';
  }
}

window.toggleCardFeatures = (planId) => {
  const list = document.getElementById(`features-list-${planId}`);
  const chevron = document.getElementById(`chevron-${planId}`);
  if (!list) return;
  const isHidden = list.classList.toggle('hide');
  if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
};

window.editPlanConfig = (planId) => {
  const plan = allPlans.find(p => p.id === planId);
  if (!plan) return;

  document.getElementById('plan-config-sidebar').classList.remove('hide');
  document.querySelectorAll('.plan-config-card').forEach(card => card.classList.toggle('active-edit', card.dataset.planId === planId));

  document.getElementById('plan-id').value = plan.id;
  const nameEl = document.getElementById('plan-name-input');
  nameEl.value = plan.name;
  nameEl.setAttribute('readonly', 'true');

  document.getElementById('plan-form-title').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color:var(--primary);"></i> تهيئة وتعديل الباقة';
  document.getElementById('plan-config-submit-btn').querySelector('.btn-text').innerText = 'حفظ خصائص الباقة';

  document.getElementById('plan-price-usd').value = plan.price_usd;
  document.getElementById('plan-price-egp').value = plan.price_egp;
  document.getElementById('plan-feat-multi-doctor').checked = !!plan.allow_multi_doctor;
  document.getElementById('plan-feat-insurance').checked = !!plan.allow_insurance;
  document.getElementById('plan-feat-refunds').checked = !!plan.allow_refunds;
  document.getElementById('plan-feat-whatsapp').checked = !!plan.allow_whatsapp;
  document.getElementById('plan-feat-telegram').checked = !!plan.allow_telegram;
  document.getElementById('plan-feat-analytics').checked = !!plan.allow_analytics;
  document.getElementById('plan-feat-voice-bot').checked = !!plan.allow_voice_bot;
  document.getElementById('plan-feat-branding').checked = !!plan.allow_custom_branding;

  const deleteBtn = document.getElementById('plan-config-delete-btn');
  deleteBtn.style.display = ['basic', 'pro', 'enterprise'].includes(plan.id.toLowerCase()) ? 'none' : 'inline-flex';
};

document.getElementById('btn-add-new-plan')?.addEventListener('click', () => {
  document.getElementById('plan-config-sidebar').classList.remove('hide');
  document.querySelectorAll('.plan-config-card').forEach(card => card.classList.remove('active-edit'));

  document.getElementById('plan-id').value = '';
  const nameEl = document.getElementById('plan-name-input');
  nameEl.value = '';
  nameEl.removeAttribute('readonly');
  nameEl.style.background = '#fff';
  nameEl.focus();

  document.getElementById('plan-form-title').innerHTML = '<i class="fa-solid fa-plus" style="color:var(--primary);"></i> إضافة باقة جديدة';
  document.getElementById('plan-config-submit-btn').querySelector('.btn-text').innerText = 'إنشاء باقة جديدة';
  document.getElementById('plan-config-delete-btn').style.display = 'none';

  document.getElementById('plan-price-usd').value = 0;
  document.getElementById('plan-price-egp').value = 0;
  ['multi-doctor', 'insurance', 'refunds', 'whatsapp', 'telegram', 'analytics', 'voice-bot', 'branding'].forEach(k => {
    document.getElementById(`plan-feat-${k}`).checked = false;
  });
});

document.getElementById('ops-plan-config-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameVal = document.getElementById('plan-name-input').value.trim();
  if (!nameVal) { showToast('يرجى إدخال اسم الباقة', 'error'); return; }

  let planId = document.getElementById('plan-id').value;
  const isNew = !planId;
  if (isNew) {
    planId = nameVal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `plan-${Math.random().toString(36).substring(2, 7)}`;
  }

  showLoading('plan-config-submit-btn');
  const payload = {
    name: nameVal,
    price_usd: parseInt(document.getElementById('plan-price-usd').value),
    price_egp: parseInt(document.getElementById('plan-price-egp').value),
    allow_multi_doctor: document.getElementById('plan-feat-multi-doctor').checked,
    allow_insurance: document.getElementById('plan-feat-insurance').checked,
    allow_refunds: document.getElementById('plan-feat-refunds').checked,
    allow_whatsapp: document.getElementById('plan-feat-whatsapp').checked,
    allow_telegram: document.getElementById('plan-feat-telegram').checked,
    allow_analytics: document.getElementById('plan-feat-analytics').checked,
    allow_voice_bot: document.getElementById('plan-feat-voice-bot').checked,
    allow_custom_branding: document.getElementById('plan-feat-branding').checked
  };

  try {
    const res = await opsFetch(`/admin/v1/plans/${planId}`, { method: 'PUT', body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      showToast(isNew ? 'تم إنشاء الباقة الجديدة بنجاح!' : 'تم حفظ خصائص الباقة بنجاح!', 'success');
      document.getElementById('plan-config-sidebar').classList.add('hide');
      loadPlansTab();
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالخادم لحفظ التعديلات.', 'error');
  } finally {
    hideLoading('plan-config-submit-btn');
  }
});

document.getElementById('plan-config-delete-btn')?.addEventListener('click', async () => {
  const planId = document.getElementById('plan-id').value;
  if (!planId || ['basic', 'pro', 'enterprise'].includes(planId.toLowerCase())) {
    showToast('لا يمكن حذف باقات النظام الأساسية.', 'error');
    return;
  }
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الباقة؟')) return;

  try {
    const res = await opsFetch(`/admin/v1/plans/${planId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف الباقة بنجاح!', 'success');
      document.getElementById('plan-config-sidebar').classList.add('hide');
      loadPlansTab();
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (e) {
    showToast('خطأ في الاتصال بالخادم لحذف الباقة.', 'error');
  }
});

document.getElementById('btn-close-plan-config')?.addEventListener('click', () => {
  document.getElementById('plan-config-sidebar').classList.add('hide');
  document.querySelectorAll('.plan-config-card').forEach(card => card.classList.remove('active-edit'));
});
