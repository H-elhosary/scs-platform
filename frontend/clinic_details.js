const API_BASE_URL = 'http://localhost:3000';
const token = sessionStorage.getItem('ops_token');

if (!token) {
  window.location.href = 'index.html';
}

// Get Tenant ID from URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const tenantId = urlParams.get('id');

if (!tenantId) {
  window.location.href = 'admin.html';
}

let currentLang = 'en';

// DOM elements
const detailsClinicName = document.getElementById('details-clinic-name');
const detailsPlanBadge = document.getElementById('details-plan-badge');
const detailsStatusBadge = document.getElementById('details-status-badge');
const detailsAlertPanel = document.getElementById('details-alert-panel');
const detailsAlertMsg = document.getElementById('details-alert-msg');
const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');

const detGeneralForm = document.getElementById('det-general-form');
const detAddDoctorForm = document.getElementById('det-add-doctor-form');
const detDeleteBtn = document.getElementById('det-delete-btn');
const detToggleStatusBtn = document.getElementById('det-toggle-status-btn');
const detResetPwdBtn = document.getElementById('det-reset-pwd-btn');
const detRenewSubmitBtn = document.getElementById('det-renew-submit-btn');
const detRenewDurationSelect = document.getElementById('det-renew-duration');

const detDoctorsListContainer = document.getElementById('det-doctors-list-container');
const detBillingTimeline = document.getElementById('det-billing-timeline');
const detAuditTableBody = document.getElementById('det-audit-table-body');

// 1. Toast & Alerts Helpers
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
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

function showLoading(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  
  btn.disabled = true;
  if (text) text.classList.add('hide');
  if (spinner) spinner.classList.remove('hide');
}

function hideLoading(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  
  btn.disabled = false;
  if (text) text.classList.remove('hide');
  if (spinner) spinner.classList.add('hide');
}

function showAlert(message) {
  detailsAlertMsg.innerText = message;
  detailsAlertPanel.classList.remove('hide');
}

function hideAlert() {
  detailsAlertPanel.classList.add('hide');
}

// Get Current Tab from URL (default: general)
const requestedTab = urlParams.get('tab') || 'general';

// Update tab links with correct clinic ID
const clinicIdParam = `?id=${tenantId}`;
const tabLinks = [
  document.getElementById('btn-tab-general'),
  document.getElementById('btn-tab-doctors'),
  document.getElementById('btn-tab-billing'),
  document.getElementById('btn-tab-audit'),
  document.getElementById('btn-tab-channels')
];

tabLinks.forEach(link => {
  if (link && link.dataset.tab) {
    link.href = `clinic_details.html?id=${tenantId}&tab=${link.dataset.tab}`;
  }
});

// 2. Tab switching logic
const tabs = [
  { id: 'general', btn: document.getElementById('btn-tab-general'), panel: document.getElementById('tab-general') },
  { id: 'doctors', btn: document.getElementById('btn-tab-doctors'), panel: document.getElementById('tab-doctors') },
  { id: 'billing', btn: document.getElementById('btn-tab-billing'), panel: document.getElementById('tab-billing') },
  { id: 'audit', btn: document.getElementById('btn-tab-audit'), panel: document.getElementById('tab-audit') },
  { id: 'channels', btn: document.getElementById('btn-tab-channels'), panel: document.getElementById('tab-channels') }
];

let isDoctorsTabLocked = false;

// Function to switch tabs
function switchDetailsTab(tabId) {
  // Validate tab ID
  const tabConfig = tabs.find(t => t.id === tabId);
  if (!tabConfig) return;
  
  // Check if doctors tab is locked
  if (tabId === 'doctors' && isDoctorsTabLocked) {
    showToast('ميزة الأطباء المتعددين غير مفعلة للباقة الحالية. قم بترقية الباقة أو تفعيل صلاحية (Multi-Doctor) أولاً لتنشيط هذا التبويب.', 'error');
    return;
  }
  
  // Remove active from all tabs
  tabs.forEach(t => {
    t.btn.classList.remove('active');
    t.panel.classList.add('hide');
  });
  
  // Add active to selected tab
  tabConfig.btn.classList.add('active');
  tabConfig.panel.classList.remove('hide');
  
  // Update URL
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tabId);
  window.history.replaceState({}, '', url);
}

// Attach click event listeners to tabs
tabs.forEach(tab => {
  tab.btn.addEventListener('click', (e) => {
    e.preventDefault();
    switchDetailsTab(tab.id);
  });
});

// 3. Parallel API fetching
async function loadAllClinicData() {
  hideAlert();
  try {
    // 1. Fetch Tenant details
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('ops_token');
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    
    if (data.success) {
      const tenant = data.data.tenant;
      detailsClinicName.innerText = tenant.name;
      
      // Update badging
      detailsPlanBadge.innerText = tenant.subscription_plan.toUpperCase();
      detailsPlanBadge.className = `plan-badge plan-${tenant.subscription_plan.toLowerCase()}`;
      
      const now = new Date();
      const expiry = new Date(tenant.expires_at);
      const isExpired = expiry <= now;

      // Populate Hero Summary Card
      const heroName = document.getElementById('hero-clinic-name');
      if (heroName) heroName.innerText = tenant.name;

      const heroOwner = document.getElementById('hero-owner-name');
      if (heroOwner) heroOwner.innerText = data.data.owner ? data.data.owner.full_name : '—';

      const heroDays = document.getElementById('hero-days-remaining');
      if (heroDays) {
        const timeDiff = expiry.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        if (isExpired) {
          const overDays = Math.abs(daysDiff);
          heroDays.innerHTML = `<span style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> منتهي منذ ${overDays} يوم</span>`;
        } else {
          heroDays.innerHTML = `<span style="color: var(--accent);"><i class="fa-solid fa-circle-check"></i> متبقي ${daysDiff} يوم</span>`;
        }
      }

      // Populate usage stats in Hero Card
      const stats = tenant.usage_stats || { total_patients: 0, total_appointments: 0, whatsapp_connection: 'disconnected', storage_used_mb: 0 };
      
      const patientsCount = document.getElementById('hero-patients-count');
      if (patientsCount) patientsCount.innerText = stats.total_patients;

      const bookingsCount = document.getElementById('hero-bookings-count');
      if (bookingsCount) bookingsCount.innerText = stats.total_appointments;

      const waStatus = document.getElementById('hero-whatsapp-status');
      if (waStatus) {
        if (stats.whatsapp_connection === 'connected') {
          waStatus.innerHTML = `<span style="color: #10b981;"><i class="fa-brands fa-whatsapp"></i> متصل</span>`;
        } else {
          waStatus.innerHTML = `<span style="color: #ef4444;"><i class="fa-brands fa-whatsapp"></i> غير متصل</span>`;
        }
      }

      const storageUsed = document.getElementById('hero-storage-used');
      if (storageUsed) storageUsed.innerText = `${stats.storage_used_mb} MB`;

      if (tenant.status === 'suspended') {
        detailsStatusBadge.innerText = 'معلق / Suspended';
        detailsStatusBadge.className = 'status-suspended-badge';
        if (detToggleStatusBtn) {
          detToggleStatusBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i><span class="btn-text">تنشيط الحساب</span>';
          detToggleStatusBtn.setAttribute('data-target-status', 'active');
        }
      } else if (isExpired) {
        detailsStatusBadge.innerText = 'منتهي / Expired';
        detailsStatusBadge.className = 'status-suspended-badge';
        if (detToggleStatusBtn) {
          detToggleStatusBtn.innerHTML = '<i class="fa-solid fa-circle-pause"></i><span class="btn-text">تعليق الحساب</span>';
          detToggleStatusBtn.setAttribute('data-target-status', 'suspended');
        }
      } else {
        detailsStatusBadge.innerText = 'نشط / Active';
        detailsStatusBadge.className = 'status-active-badge';
        if (detToggleStatusBtn) {
          detToggleStatusBtn.innerHTML = '<i class="fa-solid fa-circle-pause"></i><span class="btn-text">تعليق الحساب</span>';
          detToggleStatusBtn.setAttribute('data-target-status', 'suspended');
        }
      }

      // Populate form
      document.getElementById('det-clinic-name').value = tenant.name;
      document.getElementById('det-clinic-slug').value = tenant.slug;
      document.getElementById('det-clinic-specialty').value = tenant.specialty || 'general';
      document.getElementById('det-clinic-plan').value = tenant.subscription_plan;
      updatePlanInfoCard(tenant.subscription_plan.toLowerCase());
      document.getElementById('det-owner-email').value = data.data.owner ? data.data.owner.email : '';
      document.getElementById('det-owner-phone').value = data.data.owner ? data.data.owner.phone : '';
      
      // Feature Flags
      const multiDocAllowed = !!tenant.allow_multi_doctor;
      document.getElementById('det-feat-multi-doctor').checked = multiDocAllowed;
      document.getElementById('det-feat-insurance').checked = !!tenant.allow_insurance;
      document.getElementById('det-feat-refunds').checked = !!tenant.allow_refunds;
      document.getElementById('det-feat-whatsapp').checked = !!tenant.allow_whatsapp;
      document.getElementById('det-feat-telegram').checked = !!tenant.allow_telegram;
      document.getElementById('det-feat-analytics').checked = !!tenant.allow_analytics;
      document.getElementById('det-feat-voice-bot').checked = !!tenant.allow_voice_bot;
      document.getElementById('det-feat-branding').checked = !!tenant.allow_custom_branding;

      // Initialize Doctors tab locking status
      const docTabBtn = document.getElementById('btn-tab-doctors');
      if (!multiDocAllowed) {
        isDoctorsTabLocked = true;
        docTabBtn.innerHTML = '<i class="fa-solid fa-lock" style="margin-left: 6px; font-size: 11px; color: var(--text-muted);"></i>الأطباء والكوادر';
        docTabBtn.style.opacity = '0.6';
        docTabBtn.style.cursor = 'not-allowed';
      } else {
        isDoctorsTabLocked = false;
        docTabBtn.innerHTML = 'الأطباء والكوادر';
        docTabBtn.style.opacity = '1';
        docTabBtn.style.cursor = 'pointer';
      }

      if (isExpired) {
        showAlert('⚠️ انتبه: اشتراك هذه العيادة منتهي حالياً. يرجى تجديد الاشتراك لتفادي توقف الخدمة للعيادة.');
      }
    } else {
      showAlert(data.error.message);
      return;
    }

    // Load subparts
    loadDetailsDoctorsList();
    loadDetailsBillingHistory();
    loadDetailsAuditLogs();
    loadDetailsChannelSettings();

  } catch (error) {
    showAlert('حدث خطأ في الاتصال بالخادم أثناء جلب بيانات العيادة.');
  }
}

// Fetch Doctors list
async function loadDetailsDoctorsList() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/doctors`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      if (data.data.length === 0) {
        detDoctorsListContainer.innerHTML = '<p class="text-center text-muted" style="padding: 15px 0;">لا يوجد أطباء مسجلين بالعيادة حالياً.</p>';
        return;
      }
      
      detDoctorsListContainer.innerHTML = '';
      data.data.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doctor-card';
        card.innerHTML = `
          <div class="doctor-info-box">
            <div class="doctor-avatar-circle"><i class="fa-solid fa-user-doctor"></i></div>
            <div>
              <div class="doctor-details-name">${doc.full_name}</div>
              <div class="doctor-details-spec">${doc.specialty}</div>
            </div>
          </div>
          <span style="font-size: 11px; font-weight: bold; color: var(--primary); background: rgba(37,99,235,0.1); padding: 2px 8px; border-radius: 4px;">نشط</span>
        `;
        detDoctorsListContainer.appendChild(card);
      });
    }
  } catch (e) {
    detDoctorsListContainer.innerHTML = '<p class="text-center text-danger">فشل تحميل الأطباء</p>';
  }
}

// Fetch billing history timeline
async function loadDetailsBillingHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/subscription-history`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      if (data.data.length === 0) {
        detBillingTimeline.innerHTML = '<p class="text-center text-muted" style="padding: 15px 0;">لا يوجد سجل اشتراكات لهذه العيادة.</p>';
        return;
      }
      
      detBillingTimeline.innerHTML = '';
      data.data.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'timeline-item';
        
        const dateStr = new Date(item.created_at).toLocaleString('ar-EG');
        const oldPlan = item.old_plan ? `<span class="plan-badge plan-${item.old_plan.toLowerCase()}">${item.old_plan.toUpperCase()}</span>` : '—';
        const newPlan = `<span class="plan-badge plan-${item.new_plan.toLowerCase()}">${item.new_plan.toUpperCase()}</span>`;
        const actionText = { created: 'إنشاء عيادة', extended: 'تمديد اشتراك', upgraded: 'ترقية باقة', renewed: 'تجديد باقة' }[item.action] || item.action;

        itemEl.innerHTML = `
          <div class="timeline-badge"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-action">${actionText.toUpperCase()}</span>
              <span class="timeline-date">${dateStr}</span>
            </div>
            <div class="timeline-body">
              <p style="margin-bottom: 3px;"><strong>الخطة:</strong> ${oldPlan} ➜ ${newPlan}</p>
              <p style="margin-bottom: 3px;"><strong>تاريخ الانتهاء:</strong> ${new Date(item.new_expires_at).toLocaleDateString()}</p>
              <p style="margin-bottom: 0;"><strong>السبب:</strong> ${item.reason || '—'}</p>
            </div>
            <div class="timeline-operator">By: ${item.operator_name}</div>
          </div>
        `;
        detBillingTimeline.appendChild(itemEl);
      });
    }
  } catch (e) {
    detBillingTimeline.innerHTML = '<p class="text-center text-danger">فشل تحميل سجل الاشتراكات</p>';
  }
}

// Fetch audit logs
async function loadDetailsAuditLogs() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/audit-logs`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      const filtered = data.data.filter(log => log.target_id === tenantId || (log.details && log.details.includes(tenantId)));
      
      if (filtered.length === 0) {
        detAuditTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">لا توجد عمليات مسجلة لهذه العيادة.</td></tr>';
        return;
      }
      
      detAuditTableBody.innerHTML = '';
      filtered.forEach(log => {
        const row = document.createElement('tr');
        const dateStr = new Date(log.created_at).toLocaleString('ar-EG');
        
        let actionLabel = log.action;
        if (log.action === 'tenant.create') actionLabel = 'إنشاء عيادة';
        else if (log.action === 'tenant.deactivate') actionLabel = 'تعليق حساب';
        else if (log.action === 'tenant.activate') actionLabel = 'تنشيط حساب';
        else if (log.action === 'tenant.update') actionLabel = 'تعديل عيادة';
        else if (log.action === 'tenant.update_features') actionLabel = 'تعديل صلاحيات';
        else if (log.action === 'tenant.delete') actionLabel = 'حذف عيادة';
        else if (log.action === 'tenant.add_doctor') actionLabel = 'إضافة طبيب';
        else if (log.action === 'subscription.change') actionLabel = 'تغيير اشتراك';

        row.innerHTML = `
          <td><strong>${log.operator_name}</strong></td>
          <td><span class="plan-badge plan-pro" style="font-size: 10px;">${actionLabel}</span></td>
          <td><span class="audit-details-code" title="${log.details || ''}">${log.details || '—'}</span></td>
          <td><small>${dateStr}</small></td>
        `;
        detAuditTableBody.appendChild(row);
      });
    }
  } catch (e) {
    detAuditTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">فشل تحميل سجل العمليات</td></tr>';
  }
}

// 4. Form Submissions and updates
detGeneralForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoading('det-save-btn');

  const payload = {
    name: document.getElementById('det-clinic-name').value,
    specialty: document.getElementById('det-clinic-specialty').value,
    subscription_plan: document.getElementById('det-clinic-plan').value,
    email: document.getElementById('det-owner-email').value,
    phone: document.getElementById('det-owner-phone').value
  };

  const featuresPayload = {
    allow_multi_doctor: document.getElementById('det-feat-multi-doctor').checked,
    allow_insurance: document.getElementById('det-feat-insurance').checked,
    allow_refunds: document.getElementById('det-feat-refunds').checked,
    allow_whatsapp: document.getElementById('det-feat-whatsapp').checked,
    allow_telegram: document.getElementById('det-feat-telegram').checked,
    allow_analytics: document.getElementById('det-feat-analytics').checked,
    allow_voice_bot: document.getElementById('det-feat-voice-bot').checked,
    allow_custom_branding: document.getElementById('det-feat-branding').checked
  };

  try {
    // 1. Update details
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      // 2. Update features
      await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/features`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(featuresPayload)
      });

      showToast('تم حفظ التعديلات بنجاح!', 'success');
      loadAllClinicData();
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالشبكة.', 'error');
  } finally {
    hideLoading('det-save-btn');
  }
});

// Add new doctor
detAddDoctorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('det-doc-name');
  const specInput = document.getElementById('det-doc-spec');
  
  const payload = {
    full_name: nameInput.value.trim(),
    specialty: specInput.value.trim()
  };

  showLoading('det-add-doc-btn');
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/doctors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم إضافة الطبيب بنجاح للعيادة!', 'success');
      nameInput.value = '';
      specInput.value = '';
      loadDetailsDoctorsList();
      loadDetailsAuditLogs();
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالشبكة.', 'error');
  } finally {
    hideLoading('det-add-doc-btn');
  }
});

// Delete Clinic
detDeleteBtn.addEventListener('click', async () => {
  const confirmMsg = 'تحذير نهائي: هل أنت متأكد من حذف هذه العيادة بالكامل؟ سيؤدي ذلك لمسح كافة جداول المواعيد وملفات المرضى وقاعدة البيانات بالكامل ولا يمكن استرجاعها.';
  if (!confirm(confirmMsg)) return;

  showLoading('det-delete-btn');
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      alert('تم حذف العيادة بنجاح من المنصة.');
      window.location.href = 'admin.html';
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالشبكة.', 'error');
  } finally {
    hideLoading('det-delete-btn');
  }
});

// 5. Subscription Plan Features Indicator & Auto-flags logic
const planInfoTitle = document.getElementById('plan-info-title');
const planInfoFeatures = document.getElementById('plan-info-features');

let planFeaturesMap = {};

async function fetchPlansConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/plans`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      const detPlanSelect = document.getElementById('det-clinic-plan');
      if (detPlanSelect) {
        detPlanSelect.innerHTML = data.data.map(p => `<option value="${p.id}">${p.name} ($${p.price_usd}/m)</option>`).join('');
      }
      
      planFeaturesMap = {};
      data.data.forEach(p => {
        const id = p.id.toLowerCase();
        planFeaturesMap[id] = {
          title: `باقة ${p.name} ($${p.price_usd}/m):`,
          features: [
            `أطباء متعددون ${p.allow_multi_doctor ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `تأمين طبي ${p.allow_insurance ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `استرداد تلقائي ${p.allow_refunds ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `تنبيهات واتساب ${p.allow_whatsapp ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `بوت تليجرام ${p.allow_telegram ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `تقارير تحليلات ${p.allow_analytics ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `حجز صوتي ذكي ${p.allow_voice_bot ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`,
            `هوية مخصصة ${p.allow_custom_branding ? '<i class="fa-solid fa-circle-check text-success" style="margin-right: 4px;"></i>' : '<i class="fa-solid fa-circle-xmark text-danger" style="margin-right: 4px;"></i>'}`
          ],
          flags: {
            multiDoctor: !!p.allow_multi_doctor,
            insurance: !!p.allow_insurance,
            refunds: !!p.allow_refunds,
            whatsapp: !!p.allow_whatsapp,
            telegram: !!p.allow_telegram,
            analytics: !!p.allow_analytics,
            voiceBot: !!p.allow_voice_bot,
            branding: !!p.allow_custom_branding
          }
        };
      });
    }
  } catch (e) {
    console.error('Failed to load dynamic plan configurations:', e);
  }
}

function updatePlanInfoCard(planKey) {
  const planInfo = planFeaturesMap[planKey.toLowerCase()];
  if (planInfo) {
    planInfoTitle.innerText = planInfo.title;
    planInfoFeatures.innerHTML = planInfo.features.map(f => `<span>${f}</span>`).join('');
  } else {
    planInfoTitle.innerText = planKey.toUpperCase();
    planInfoFeatures.innerHTML = '';
  }
}

function updateDoctorsTabLock(isChecked) {
  const docTabBtn = document.getElementById('btn-tab-doctors');
  if (!isChecked) {
    isDoctorsTabLocked = true;
    docTabBtn.innerHTML = '<i class="fa-solid fa-lock" style="margin-left: 6px; font-size: 11px; color: var(--text-muted);"></i>الأطباء والكوادر';
    docTabBtn.style.opacity = '0.6';
    docTabBtn.style.cursor = 'not-allowed';
  } else {
    isDoctorsTabLocked = false;
    docTabBtn.innerHTML = 'الأطباء والكوادر';
    docTabBtn.style.opacity = '1';
    docTabBtn.style.cursor = 'pointer';
  }
}

// Event listener to update doctors tab when multi-doctor flag changes manually
document.getElementById('det-feat-multi-doctor').addEventListener('change', (e) => {
  updateDoctorsTabLock(e.target.checked);
});

// Event listener to auto-toggle features when plan changes
document.getElementById('det-clinic-plan').addEventListener('change', (e) => {
  const planKey = e.target.value.toLowerCase();
  updatePlanInfoCard(planKey);
  
  const planInfo = planFeaturesMap[planKey];
  if (planInfo) {
    document.getElementById('det-feat-multi-doctor').checked = planInfo.flags.multiDoctor;
    document.getElementById('det-feat-insurance').checked = planInfo.flags.insurance;
    document.getElementById('det-feat-refunds').checked = planInfo.flags.refunds;
    document.getElementById('det-feat-whatsapp').checked = planInfo.flags.whatsapp;
    document.getElementById('det-feat-telegram').checked = planInfo.flags.telegram;
    document.getElementById('det-feat-analytics').checked = planInfo.flags.analytics;
    document.getElementById('det-feat-voice-bot').checked = planInfo.flags.voiceBot;
    document.getElementById('det-feat-branding').checked = planInfo.flags.branding;
    
    // Update locking status
    updateDoctorsTabLock(planInfo.flags.multiDoctor);
  }
});
// Toggle clinic status (Suspend/Reactivate)
if (detToggleStatusBtn) {
  detToggleStatusBtn.addEventListener('click', async () => {
    const targetStatus = detToggleStatusBtn.getAttribute('data-target-status');
    const confirmMsg = targetStatus === 'suspended'
      ? (currentLang === 'ar' ? 'هل أنت متأكد من تعليق حساب العيادة؟ لن يتمكن الكادر الطبي من الدخول.' : 'Are you sure you want to suspend this clinic? Staff will not be able to log in.')
      : (currentLang === 'ar' ? 'هل أنت متأكد من تنشيط حساب العيادة؟' : 'Are you sure you want to reactivate this clinic?');
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(currentLang === 'ar' ? 'تم تحديث حالة العيادة بنجاح.' : 'Clinic status updated successfully.', 'success');
        loadAllClinicData();
      } else {
        showToast(data.error.message, 'error');
      }
    } catch (e) {
      showToast(currentLang === 'ar' ? 'خطأ في الاتصال بالخادم.' : 'Server connection error.', 'error');
    }
  });
}

// Reset Doctor Password
if (detResetPwdBtn) {
  detResetPwdBtn.addEventListener('click', async () => {
    const confirmMsg = currentLang === 'ar'
      ? 'هل أنت متأكد من إعادة تعيين كلمة المرور لطبيب العيادة المالك؟ سيتم توليد رابط جديد.'
      : 'Are you sure you want to reset the password for the clinic owner doctor? A new link will be generated.';
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/reset-password`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(currentLang === 'ar' ? 'تمت إعادة التعيين بنجاح. تم طباعة الرابط في Console الخادم.' : 'Password reset link generated. Output in server console.', 'success');
        alert(currentLang === 'ar' 
          ? `رابط إعادة التعيين:\n${data.data.reset_link}`
          : `Reset Link:\n${data.data.reset_link}`);
      } else {
        showToast(data.error.message, 'error');
      }
    } catch (e) {
      showToast(currentLang === 'ar' ? 'خطأ في الاتصال بالخادم.' : 'Server connection error.', 'error');
    }
  });
}

// Renew Subscription
if (detRenewSubmitBtn) {
  detRenewSubmitBtn.addEventListener('click', async () => {
    const months = detRenewDurationSelect.value;
    showLoading('det-renew-submit-btn');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/tenants/${tenantId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ months_to_extend: months })
      });
      const data = await res.json();
      hideLoading('det-renew-submit-btn');
      if (data.success) {
        showToast(currentLang === 'ar' ? 'تم تجديد الاشتراك وتمديده بنجاح.' : 'Subscription renewed and extended successfully.', 'success');
        loadAllClinicData();
      } else {
        showToast(data.error.message, 'error');
      }
    } catch (e) {
      hideLoading('det-renew-submit-btn');
      showToast(currentLang === 'ar' ? 'خطأ في الاتصال بالخادم.' : 'Server connection error.', 'error');
    }
  });
}

// ═══ Channel Integration API Settings (Super Admin Only) ═══
async function loadDetailsChannelSettings() {
  try {
    // In our SaaS mock server, we fetch channel settings for this clinic
    const res = await fetch(`${API_BASE_URL}/v1/settings/channels`).then(r => r.json());
    if (res.success) {
      const d = res.data;
      document.getElementById('det-wa-phone-id').value = d.whatsapp.phone_number_id || '';
      document.getElementById('det-wa-business-id').value = d.whatsapp.business_account_id || '';
      document.getElementById('det-wa-token').value = d.whatsapp.access_token || '';
      document.getElementById('det-wa-webhook').textContent = d.whatsapp.webhook_url || '';
      document.getElementById('det-wa-verify').textContent = d.whatsapp.verify_token || '';

      document.getElementById('det-tg-token').value = d.telegram.bot_token || '';
      document.getElementById('det-tg-username').value = d.telegram.bot_username || '';
    }
  } catch (e) { console.error('Failed to load details channel settings:', e); }
}

async function saveAdminWhatsapp() {
  const btn = document.getElementById('btn-save-det-wa');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
  try {
    const res = await fetch(`${API_BASE_URL}/v1/settings/channels/whatsapp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number_id: document.getElementById('det-wa-phone-id').value,
        business_account_id: document.getElementById('det-wa-business-id').value,
        access_token: document.getElementById('det-wa-token').value
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ إعدادات واتساب بنجاح!', 'success');
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ إعدادات واتساب';
}

async function testAdminWhatsapp() {
  const btn = document.getElementById('btn-test-det-wa');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاختبار...';
  
  await saveAdminWhatsapp();

  try {
    const res = await fetch(`${API_BASE_URL}/v1/settings/channels/whatsapp/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());

    if (res.success) {
      showToast(res.data.message, 'success');
    } else {
      showToast(res.error?.message || 'فشل الاتصال', 'error');
    }
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-vial"></i> اختبار اتصال الواتساب';
}

async function saveAdminTelegram() {
  const btn = document.getElementById('btn-save-det-tg');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
  try {
    const res = await fetch(`${API_BASE_URL}/v1/settings/channels/telegram`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_token: document.getElementById('det-tg-token').value,
        bot_username: document.getElementById('det-tg-username').value
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ إعدادات تليجرام بنجاح!', 'success');
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ إعدادات تليجرام';
}

async function testAdminTelegram() {
  const btn = document.getElementById('btn-test-det-tg');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الربط...';

  await saveAdminTelegram();

  try {
    const res = await fetch(`${API_BASE_URL}/v1/settings/channels/telegram/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());

    if (res.success) {
      showToast(res.data.message, 'success');
    } else {
      showToast(res.error?.message || 'فشل الاتصال', 'error');
    }
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-link"></i> ربط وتفعيل الـ Webhook تلقائياً';
}

function copyToClipboardText(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    if (btnEl) {
      const origText = btnEl.innerText;
      btnEl.innerText = 'تم النسخ!';
      btnEl.style.background = '#10b981';
      btnEl.style.color = 'white';
      setTimeout(() => {
        btnEl.innerText = origText;
        btnEl.style.background = '';
        btnEl.style.color = '';
      }, 1500);
    }
    showToast('تم النسخ للحافظة بنجاح', 'success');
  }).catch(() => showToast('فشل النسخ', 'error'));
}

// Load everything on startup
async function initPage() {
  await fetchPlansConfig();
  await loadAllClinicData();
  // Apply the requested tab from URL
  switchDetailsTab(requestedTab);
}
initPage();
