// ==========================================
// Smart Clinic OS (SCS) — Clinic Details Controller
// Auth, sidebar, toast/modal helpers come from core/ops-shared.js.
// ==========================================

const urlParams = new URLSearchParams(window.location.search);
const tenantId = urlParams.get('id');
if (!tenantId) window.location.href = 'admin_clinics.html';

const detailsAlertPanel = document.getElementById('details-alert-panel');
const detailsAlertMsg = document.getElementById('details-alert-msg');
function showAlert(message) { detailsAlertMsg.innerText = message; detailsAlertPanel.classList.remove('hide'); }

const detGeneralForm = document.getElementById('det-general-form');
const detAddDoctorForm = document.getElementById('det-add-doctor-form');
const detDoctorsListContainer = document.getElementById('det-doctors-list-container');
const detBillingTimeline = document.getElementById('det-billing-timeline');
const detAuditTableBody = document.getElementById('det-audit-table-body');
const detToggleStatusBtn = document.getElementById('det-toggle-status-btn');

let isDoctorsTabLocked = false;
let planFeaturesMap = {};

// --- Tabs ---
const tabs = ['general', 'doctors', 'billing', 'audit', 'channels'].map(id => ({
  id, btn: document.getElementById(`btn-tab-${id}`), panel: document.getElementById(`tab-${id}`)
}));

function switchDetailsTab(tabId) {
  const tabConfig = tabs.find(t => t.id === tabId);
  if (!tabConfig) return;
  if (tabId === 'doctors' && isDoctorsTabLocked) {
    showToast('ميزة الأطباء المتعددين غير مفعلة للباقة الحالية. فعّل صلاحية Multi-Doctor أولاً من تبويب البيانات والصلاحيات.', 'error');
    return;
  }
  tabs.forEach(t => { t.btn.classList.remove('active'); t.panel.classList.add('hide'); });
  tabConfig.btn.classList.add('active');
  tabConfig.panel.classList.remove('hide');

  const url = new URL(window.location.href);
  url.searchParams.set('tab', tabId);
  window.history.replaceState({}, '', url);
}
tabs.forEach(t => t.btn.addEventListener('click', (e) => { e.preventDefault(); switchDetailsTab(t.id); }));

function updateDoctorsTabLock(isChecked) {
  const docTabBtn = document.getElementById('btn-tab-doctors');
  isDoctorsTabLocked = !isChecked;
  docTabBtn.classList.toggle('locked', isDoctorsTabLocked);
  docTabBtn.innerHTML = isDoctorsTabLocked
    ? '<i class="fa-solid fa-lock" style="font-size:11px; color:var(--scs-text-dim);"></i> الأطباء والكوادر'
    : 'الأطباء والكوادر';
}
document.getElementById('det-feat-multi-doctor').addEventListener('change', (e) => updateDoctorsTabLock(e.target.checked));

// --- Load everything ---
async function initPage() {
  await fetchPlansConfig();
  await loadAllClinicData();
  switchDetailsTab(urlParams.get('tab') || 'general');
}

async function fetchPlansConfig() {
  try {
    const res = await opsFetch('/admin/v1/plans');
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('det-clinic-plan').innerHTML = data.data.map(p => `<option value="${p.id}">${escapeHtml(p.name)} ($${p.price_usd}/m)</option>`).join('');

    planFeaturesMap = {};
    data.data.forEach(p => {
      const id = p.id.toLowerCase();
      const chip = (label, on) => `<span>${label} ${on ? '<i class="fa-solid fa-circle-check" style="color:var(--scs-success); margin-right:4px;"></i>' : '<i class="fa-solid fa-circle-xmark" style="color:var(--scs-danger); margin-right:4px;"></i>'}</span>`;
      planFeaturesMap[id] = {
        title: `باقة ${p.name} ($${p.price_usd}/m):`,
        features: [
          chip('أطباء متعددون', p.allow_multi_doctor), chip('تأمين طبي', p.allow_insurance),
          chip('استرداد تلقائي', p.allow_refunds), chip('تنبيهات واتساب', p.allow_whatsapp),
          chip('بوت تليجرام', p.allow_telegram), chip('تقارير تحليلات', p.allow_analytics),
          chip('حجز صوتي ذكي', p.allow_voice_bot), chip('هوية مخصصة', p.allow_custom_branding)
        ],
        flags: {
          multiDoctor: !!p.allow_multi_doctor, insurance: !!p.allow_insurance, refunds: !!p.allow_refunds,
          whatsapp: !!p.allow_whatsapp, telegram: !!p.allow_telegram, analytics: !!p.allow_analytics,
          voiceBot: !!p.allow_voice_bot, branding: !!p.allow_custom_branding
        }
      };
    });
  } catch (e) { console.error('Failed to load plan configurations:', e); }
}

function updatePlanInfoCard(planKey) {
  const info = planFeaturesMap[planKey.toLowerCase()];
  const titleEl = document.getElementById('plan-info-title');
  const featsEl = document.getElementById('plan-info-features');
  if (info) {
    titleEl.innerText = info.title;
    featsEl.innerHTML = info.features.join('');
  } else {
    titleEl.innerText = planKey.toUpperCase();
    featsEl.innerHTML = '';
  }
}

document.getElementById('det-clinic-plan').addEventListener('change', (e) => {
  const planKey = e.target.value.toLowerCase();
  updatePlanInfoCard(planKey);
  const info = planFeaturesMap[planKey];
  if (info) {
    document.getElementById('det-feat-multi-doctor').checked = info.flags.multiDoctor;
    document.getElementById('det-feat-insurance').checked = info.flags.insurance;
    document.getElementById('det-feat-refunds').checked = info.flags.refunds;
    document.getElementById('det-feat-whatsapp').checked = info.flags.whatsapp;
    document.getElementById('det-feat-telegram').checked = info.flags.telegram;
    document.getElementById('det-feat-analytics').checked = info.flags.analytics;
    document.getElementById('det-feat-voice-bot').checked = info.flags.voiceBot;
    document.getElementById('det-feat-branding').checked = info.flags.branding;
    updateDoctorsTabLock(info.flags.multiDoctor);
  }
});

async function loadAllClinicData() {
  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}`);
    const data = await res.json();
    if (!data.success) { showAlert(data.error.message); return; }

    const tenant = data.data.tenant;
    document.getElementById('details-clinic-name').innerText = tenant.name;
    document.getElementById('details-plan-badge').innerText = tenant.subscription_plan.toUpperCase();
    document.getElementById('details-plan-badge').className = `plan-badge plan-${tenant.subscription_plan.toLowerCase()}`;

    const now = new Date();
    const expiry = new Date(tenant.expires_at);
    const isExpired = expiry <= now;

    document.getElementById('hero-clinic-name').innerText = tenant.name;
    document.getElementById('hero-owner-name').innerText = data.data.owner ? data.data.owner.full_name : '—';

    const heroDays = document.getElementById('hero-days-remaining');
    const daysDiff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
    heroDays.innerHTML = isExpired
      ? `<span style="color:var(--scs-danger);"><i class="fa-solid fa-triangle-exclamation"></i> منتهي منذ ${Math.abs(daysDiff)} يوم</span>`
      : `<span style="color:var(--primary);"><i class="fa-solid fa-circle-check"></i> متبقي ${daysDiff} يوم</span>`;

    const stats = tenant.usage_stats || { total_patients: 0, total_appointments: 0, whatsapp_connection: 'disconnected', doctor_count: 0 };
    document.getElementById('hero-patients-count').innerText = stats.total_patients;
    document.getElementById('hero-bookings-count').innerText = stats.total_appointments;
    document.getElementById('hero-whatsapp-status').innerHTML = stats.whatsapp_connection === 'connected'
      ? `<span style="color:var(--scs-success);"><i class="fa-brands fa-whatsapp"></i> متصل</span>`
      : `<span style="color:var(--scs-danger);"><i class="fa-brands fa-whatsapp"></i> غير متصل</span>`;
    document.getElementById('hero-doctors-count').innerText = stats.doctor_count;

    const statusBadge = document.getElementById('details-status-badge');
    if (tenant.status === 'suspended') {
      statusBadge.innerText = 'معلق'; statusBadge.className = 'status-suspended-badge';
      detToggleStatusBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i><span class="btn-text">تنشيط الحساب</span>';
      detToggleStatusBtn.setAttribute('data-target-status', 'active');
    } else if (isExpired) {
      statusBadge.innerText = 'منتهي'; statusBadge.className = 'status-suspended-badge';
      detToggleStatusBtn.innerHTML = '<i class="fa-solid fa-circle-pause"></i><span class="btn-text">تعليق الحساب</span>';
      detToggleStatusBtn.setAttribute('data-target-status', 'suspended');
      showAlert('انتبه: اشتراك هذه العيادة منتهي حالياً. يرجى تجديد الاشتراك لتفادي توقف الخدمة.');
    } else {
      statusBadge.innerText = 'نشط'; statusBadge.className = 'status-active-badge';
      detToggleStatusBtn.innerHTML = '<i class="fa-solid fa-circle-pause"></i><span class="btn-text">تعليق الحساب</span>';
      detToggleStatusBtn.setAttribute('data-target-status', 'suspended');
    }

    document.getElementById('det-clinic-name').value = tenant.name;
    document.getElementById('det-clinic-slug').value = tenant.slug;
    document.getElementById('det-clinic-specialty').value = tenant.specialty || 'general';
    document.getElementById('det-clinic-plan').value = tenant.subscription_plan;
    updatePlanInfoCard(tenant.subscription_plan.toLowerCase());
    document.getElementById('det-owner-email').value = data.data.owner ? data.data.owner.email : '';
    document.getElementById('det-owner-phone').value = data.data.owner ? data.data.owner.phone : '';

    const multiDocAllowed = !!tenant.allow_multi_doctor;
    document.getElementById('det-feat-multi-doctor').checked = multiDocAllowed;
    document.getElementById('det-feat-insurance').checked = !!tenant.allow_insurance;
    document.getElementById('det-feat-refunds').checked = !!tenant.allow_refunds;
    document.getElementById('det-feat-whatsapp').checked = !!tenant.allow_whatsapp;
    document.getElementById('det-feat-telegram').checked = !!tenant.allow_telegram;
    document.getElementById('det-feat-analytics').checked = !!tenant.allow_analytics;
    document.getElementById('det-feat-voice-bot').checked = !!tenant.allow_voice_bot;
    document.getElementById('det-feat-branding').checked = !!tenant.allow_custom_branding;
    updateDoctorsTabLock(multiDocAllowed);

    loadDetailsDoctorsList();
    loadDetailsBillingHistory();
    loadDetailsAuditLogs();
    loadDetailsChannelSettings();
  } catch (error) {
    showAlert('حدث خطأ في الاتصال بالخادم أثناء جلب بيانات العيادة.');
  }
}

async function loadDetailsDoctorsList() {
  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}/doctors`);
    const data = await res.json();
    if (!data.success) return;
    if (data.data.length === 0) {
      detDoctorsListContainer.innerHTML = '<p style="text-align:center; color:var(--scs-text-muted); padding:15px 0;">لا يوجد أطباء مسجلين بالعيادة حالياً.</p>';
      return;
    }
    detDoctorsListContainer.innerHTML = data.data.map(doc => `
      <div class="doctor-card">
        <div class="doctor-info-box">
          <div class="doctor-avatar-circle"><i class="fa-solid fa-user-doctor"></i></div>
          <div><div class="doctor-details-name">${escapeHtml(doc.full_name)}</div><div class="doctor-details-spec">${escapeHtml(doc.specialty || '—')}</div></div>
        </div>
        <span class="status-active-badge" style="font-size:11px;">نشط</span>
      </div>`).join('');
  } catch (e) {
    detDoctorsListContainer.innerHTML = '<p style="text-align:center; color:var(--scs-danger);">فشل تحميل الأطباء</p>';
  }
}

const billingActionLabels = { created: 'إنشاء عيادة', extended: 'تمديد اشتراك', upgraded: 'ترقية باقة', renewed: 'تجديد باقة' };

async function loadDetailsBillingHistory() {
  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}/subscription-history`);
    const data = await res.json();
    if (!data.success) return;
    if (data.data.length === 0) {
      detBillingTimeline.innerHTML = '<p style="text-align:center; color:var(--scs-text-muted); padding:15px 0;">لا يوجد سجل اشتراكات لهذه العيادة.</p>';
      return;
    }
    detBillingTimeline.innerHTML = data.data.map(item => {
      const oldPlan = item.old_plan ? `<span class="plan-badge plan-${item.old_plan.toLowerCase()}">${item.old_plan.toUpperCase()}</span>` : '—';
      const newPlan = `<span class="plan-badge plan-${item.new_plan.toLowerCase()}">${item.new_plan.toUpperCase()}</span>`;
      return `
        <div class="timeline-item">
          <div class="timeline-badge"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-action">${(billingActionLabels[item.action] || item.action).toUpperCase()}</span>
              <span class="timeline-date">${new Date(item.created_at).toLocaleString('ar-EG')}</span>
            </div>
            <p><strong>الخطة:</strong> ${oldPlan} ➜ ${newPlan}</p>
            <p><strong>تاريخ الانتهاء:</strong> ${new Date(item.new_expires_at).toLocaleDateString('ar-EG')}</p>
            <p><strong>السبب:</strong> ${escapeHtml(item.reason || '—')}</p>
            <div class="timeline-operator">بواسطة: ${escapeHtml(item.operator_name)}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    detBillingTimeline.innerHTML = '<p style="text-align:center; color:var(--scs-danger);">فشل تحميل سجل الاشتراكات</p>';
  }
}

const auditActionLabels = {
  'tenant.create': 'إنشاء عيادة', 'tenant.deactivate': 'تعليق حساب', 'tenant.activate': 'تنشيط حساب',
  'tenant.update': 'تعديل عيادة', 'tenant.update_features': 'تعديل صلاحيات', 'tenant.delete': 'حذف عيادة',
  'tenant.add_doctor': 'إضافة طبيب', 'subscription.change': 'تغيير اشتراك'
};

async function loadDetailsAuditLogs() {
  try {
    const res = await opsFetch('/admin/v1/audit-logs');
    const data = await res.json();
    if (!data.success) return;
    const filtered = data.data.filter(log => log.target_id === tenantId || (log.details && log.details.includes(tenantId)));
    if (filtered.length === 0) {
      detAuditTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:var(--scs-text-muted);">لا توجد عمليات مسجلة لهذه العيادة.</td></tr>';
      return;
    }
    detAuditTableBody.innerHTML = filtered.map(log => `
      <tr>
        <td><strong>${escapeHtml(log.operator_name)}</strong></td>
        <td><span class="plan-badge plan-pro" style="font-size:10px;">${auditActionLabels[log.action] || log.action}</span></td>
        <td><span class="audit-details-code" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details || '—')}</span></td>
        <td><small>${new Date(log.created_at).toLocaleString('ar-EG')}</small></td>
      </tr>`).join('');
  } catch (e) {
    detAuditTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:var(--scs-danger);">فشل تحميل سجل العمليات</td></tr>';
  }
}

// --- Form submissions ---
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
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}`, { method: 'PUT', body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      const featRes = await opsFetch(`/admin/v1/tenants/${tenantId}/features`, { method: 'PUT', body: JSON.stringify(featuresPayload) });
      const featData = await featRes.json();
      if (featData.success) {
        showToast('تم حفظ التعديلات بنجاح!', 'success');
      } else {
        showToast('تم حفظ البيانات، لكن فشل حفظ الصلاحيات: ' + (featData.error?.message || ''), 'error');
      }
      loadAllClinicData();
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالشبكة.', 'error');
  } finally {
    hideLoading('det-save-btn', 'حفظ التغييرات والصلاحيات');
  }
});

detAddDoctorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('det-doc-name');
  const specInput = document.getElementById('det-doc-spec');

  showLoading('det-add-doc-btn');
  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}/doctors`, {
      method: 'POST',
      body: JSON.stringify({ full_name: nameInput.value.trim(), specialty: specInput.value.trim() })
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم إضافة الطبيب بنجاح للعيادة!', 'success');
      nameInput.value = ''; specInput.value = '';
      loadDetailsDoctorsList();
      loadDetailsAuditLogs();
    } else {
      showToast(data.error.message, 'error');
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالشبكة.', 'error');
  } finally {
    hideLoading('det-add-doc-btn', 'تأكيد إضافة الطبيب');
  }
});

document.getElementById('det-delete-btn').addEventListener('click', async () => {
  const confirmMsg = 'تحذير: هل أنت متأكد من حذف هذه العيادة نهائياً؟ سيتم تعطيل الحساب وحذف مستخدميه الإداريين، ولا يمكن التراجع عن هذا الإجراء.';
  if (!confirm(confirmMsg)) return;

  showLoading('det-delete-btn');
  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف العيادة بنجاح من المنصة.', 'success');
      setTimeout(() => { window.location.href = 'admin_clinics.html'; }, 1200);
    } else {
      showToast(data.error.message, 'error');
      hideLoading('det-delete-btn', null);
    }
  } catch (error) {
    showToast('خطأ في الاتصال بالشبكة.', 'error');
    hideLoading('det-delete-btn', null);
  }
});

detToggleStatusBtn.addEventListener('click', async () => {
  const targetStatus = detToggleStatusBtn.getAttribute('data-target-status');
  const confirmMsg = targetStatus === 'suspended'
    ? 'هل أنت متأكد من تعليق حساب العيادة؟ سيتوقف البوت عن استقبال حجوزات جديدة لحين إعادة التنشيط.'
    : 'هل أنت متأكد من تنشيط حساب العيادة؟';
  if (!confirm(confirmMsg)) return;

  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}/status`, { method: 'PUT', body: JSON.stringify({ status: targetStatus }) });
    const data = await res.json();
    if (data.success) { showToast('تم تحديث حالة العيادة بنجاح.', 'success'); loadAllClinicData(); }
    else showToast(data.error.message, 'error');
  } catch (e) { showToast('خطأ في الاتصال بالخادم.', 'error'); }
});

document.getElementById('det-reset-pwd-btn').addEventListener('click', async () => {
  if (!confirm('هل أنت متأكد من إعادة تعيين كلمة مرور طبيب العيادة المالك؟ سيتم توليد كلمة مرور جديدة وإرسالها له بالبريد الإلكتروني.')) return;

  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (data.success) showToast('تمت إعادة تعيين كلمة المرور، وأُرسلت للطبيب عبر البريد الإلكتروني.', 'success');
    else showToast(data.error.message, 'error');
  } catch (e) { showToast('خطأ في الاتصال بالخادم.', 'error'); }
});

document.getElementById('det-renew-submit-btn').addEventListener('click', async () => {
  const months = document.getElementById('det-renew-duration').value;
  showLoading('det-renew-submit-btn');
  try {
    const res = await opsFetch(`/admin/v1/tenants/${tenantId}/subscription`, { method: 'PUT', body: JSON.stringify({ months_to_extend: months }) });
    const data = await res.json();
    if (data.success) { showToast('تم تجديد الاشتراك وتمديده بنجاح.', 'success'); loadAllClinicData(); }
    else showToast(data.error.message, 'error');
  } catch (e) {
    showToast('خطأ في الاتصال بالخادم.', 'error');
  } finally {
    hideLoading('det-renew-submit-btn', 'تجديد الاشتراك');
  }
});

// --- Channel settings (calls the clinic-app server directly, not the ops API) ---
const CLINIC_API_BASE = 'http://localhost:3001';

async function loadDetailsChannelSettings() {
  try {
    const res = await fetch(`${CLINIC_API_BASE}/v1/settings/channels`).then(r => r.json());
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
  } catch (e) { console.error('Failed to load channel settings:', e); }
}

async function saveAdminWhatsapp() {
  const btn = document.getElementById('btn-save-det-wa');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
  try {
    const res = await fetch(`${CLINIC_API_BASE}/v1/settings/channels/whatsapp`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number_id: document.getElementById('det-wa-phone-id').value,
        business_account_id: document.getElementById('det-wa-business-id').value,
        access_token: document.getElementById('det-wa-token').value
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ إعدادات واتساب بنجاح!', 'success');
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ إعدادات واتساب';
}

async function testAdminWhatsapp() {
  const btn = document.getElementById('btn-test-det-wa');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاختبار...';
  await saveAdminWhatsapp();
  try {
    const res = await fetch(`${CLINIC_API_BASE}/v1/settings/channels/whatsapp/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json());
    if (res.success) showToast(res.data.message, 'success'); else showToast(res.error?.message || 'فشل الاتصال', 'error');
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-vial"></i> اختبار الاتصال';
}

async function saveAdminTelegram() {
  const btn = document.getElementById('btn-save-det-tg');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
  try {
    const res = await fetch(`${CLINIC_API_BASE}/v1/settings/channels/telegram`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token: document.getElementById('det-tg-token').value, bot_username: document.getElementById('det-tg-username').value })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ إعدادات تليجرام بنجاح!', 'success');
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ إعدادات تليجرام';
}

async function testAdminTelegram() {
  const btn = document.getElementById('btn-test-det-tg');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الربط...';
  await saveAdminTelegram();
  try {
    const res = await fetch(`${CLINIC_API_BASE}/v1/settings/channels/telegram/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json());
    if (res.success) showToast(res.data.message, 'success'); else showToast(res.error?.message || 'فشل الاتصال', 'error');
  } catch (e) { showToast('خطأ في الاتصال بالخادم', 'error'); }
  btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-link"></i> ربط وتفعيل الـ Webhook';
}

function copyToClipboardText(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    if (btnEl) {
      const origText = btnEl.innerText;
      btnEl.innerText = 'تم النسخ!';
      setTimeout(() => { btnEl.innerText = origText; }, 1500);
    }
    showToast('تم النسخ للحافظة بنجاح', 'success');
  }).catch(() => showToast('فشل النسخ', 'error'));
}

document.addEventListener('opsShellReady', initPage);
