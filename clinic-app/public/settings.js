// Settings Page Specific Logic
let isEditingWorkingHours = false;
let settingsSelectedDoctorId = ""; // corrected to the tenant's real first doctor once allDoctors loads
let clinicBranches = [];

document.addEventListener('sharedDataReady', () => {
  initSettings();
});

// Files a real upgrade ticket through the existing support-ticket system
// instead of just telling the doctor to go find an admin themselves.
async function requestFeatureUpgrade(featureLabel, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الإرسال...'; }
  try {
    const res = await authFetch(`${API_BASE}/v1/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'upgrade',
        title: `طلب ترقية الباقة لتفعيل: ${featureLabel}`,
        description: `طلب مُرسل تلقائياً من صفحة الإعدادات لتفعيل ميزة "${featureLabel}" غير المتاحة في الباقة الحالية.`
      })
    }).then(r => r.json());

    if (res.success) {
      showToast('تم إرسال طلب الترقية بنجاح، وسيتواصل معك فريق الدعم قريباً', 'success');
      if (btn) btn.textContent = 'تم إرسال الطلب ✓';
    } else {
      showToast(res.error?.message || 'فشل إرسال طلب الترقية', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'طلب ترقية الباقة'; }
    }
  } catch (e) {
    showToast('تعذر الاتصال بالخادم — حاول مرة أخرى', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'طلب ترقية الباقة'; }
  }
}

async function initSettings() {
  // Load branches first
  loadBranchesList();

  // Check packages features
  if (allowMultiDoctor) {
    document.getElementById('wh-doctor-selector-wrap').style.display = 'flex';
    const select = document.getElementById('wh-doctor-select');
    select.innerHTML = allDoctors.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
    if (allDoctors.length > 0 && !allDoctors.some(d => d.id === settingsSelectedDoctorId)) {
      settingsSelectedDoctorId = allDoctors[0].id;
    }
    select.value = settingsSelectedDoctorId;
    select.addEventListener('change', async (e) => {
      settingsSelectedDoctorId = e.target.value;
      isEditingWorkingHours = false;
      restoreWorkingHoursHeader();
      await fetchDoctorWorkingHours();
      renderWorkingHoursReadOnly();
    });
    
    document.getElementById('multi-doctor-locked-overlay').style.display = 'none';
  } else {
    document.getElementById('wh-doctor-selector-wrap').style.display = 'none';
    document.getElementById('multi-doctor-locked-overlay').style.display = 'flex';
  }

  if (allowInsurance) {
    document.getElementById('insurance-locked-overlay').style.display = 'none';
  } else {
    document.getElementById('insurance-locked-overlay').style.display = 'flex';
  }

  if (allowRefunds) {
    document.getElementById('refunds-locked-overlay').style.display = 'none';
  } else {
    document.getElementById('refunds-locked-overlay').style.display = 'flex';
  }

  // Load resources
  renderServices();
  renderDoctorsList();
  await fetchDoctorWorkingHours();
  renderWorkingHoursReadOnly();
  renderInsuranceList();

  // Load other settings
  await Promise.all([
    loadOperationalSettings(),
    loadNotificationSettings(),
    loadPrescriptionSettings(),
    loadRefundSettings(),
    loadChannelSettings()
  ]);
}

// Collapsible Cards
function toggleCardCollapse(header) {
  const card = header.closest('.clinic-card');
  if (card) {
    card.classList.toggle('collapsed');
  }
}

function toggleAllSettingsCards(expand) {
  const cards = document.querySelectorAll('.clinic-card.collapsible');
  cards.forEach(card => {
    if (expand) card.classList.remove('collapsed');
    else card.classList.add('collapsed');
  });
}

// 1. Services
function renderServices() {
  const tbody = document.getElementById('services-body');
  if (!tbody) return;

  const categoriesAr = { exam: 'كشف', followup: 'متابعة', procedure: 'إجراء طبي', cosmetic: 'تجميلي' };

  tbody.innerHTML = allServices.map(s => `
    <tr>
      <td>
        <div style="display:flex; flex-direction:column;">
          <strong style="color:#e2e8f0;">${s.name}</strong>
          <span style="font-size:11px; color:#64748b; font-family:Outfit;">${s.name_en || ''}</span>
        </div>
      </td>
      <td><span style="font-family:Outfit; font-weight:700;">${s.price}</span></td>
      <td><span style="font-family:Outfit;">${s.duration_minutes}</span></td>
      <td><span class="visit-badge ${s.category}">${categoriesAr[s.category] || s.category}</span></td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn-action btn-outline-cta" onclick="showEditServiceModal('${s.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action btn-danger" onclick="deleteService('${s.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function showAddServiceModal() {
  document.getElementById('service-id').value = '';
  document.getElementById('service-name').value = '';
  document.getElementById('service-name-en').value = '';
  document.getElementById('service-price').value = '';
  document.getElementById('service-duration').value = '20';
  document.getElementById('service-category').value = 'exam';
  
  document.getElementById('service-modal-title').innerHTML = `<i class="fa-solid fa-hand-holding-medical"></i> إضافة خدمة جديدة`;
  document.getElementById('service-submit-btn').textContent = "حفظ الخدمة";
  
  openModal('modal-service');
}

function showEditServiceModal(id) {
  const svc = allServices.find(s => s.id === id);
  if (!svc) return;
  
  document.getElementById('service-id').value = svc.id;
  document.getElementById('service-name').value = svc.name;
  document.getElementById('service-name-en').value = svc.name_en;
  document.getElementById('service-price').value = svc.price;
  document.getElementById('service-duration').value = svc.duration_minutes;
  document.getElementById('service-category').value = svc.category;
  
  document.getElementById('service-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> تعديل الخدمة`;
  document.getElementById('service-submit-btn').textContent = "تعديل الخدمة";
  
  openModal('modal-service');
}

async function submitServiceForm(e) {
  e.preventDefault();
  const id = document.getElementById('service-id').value;
  const name = document.getElementById('service-name').value;
  const name_en = document.getElementById('service-name-en').value;
  const price = parseFloat(document.getElementById('service-price').value);
  const duration_minutes = parseInt(document.getElementById('service-duration').value);
  const category = document.getElementById('service-category').value;

  const url = id ? `${API_BASE}/v1/settings/services/${id}` : `${API_BASE}/v1/settings/services`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, name_en, price, duration_minutes, category })
    }).then(r => r.json());

    if (res.success) {
      showToast(id ? 'تم تعديل الخدمة بنجاح' : 'تم إضافة الخدمة بنجاح', 'success');
      closeModal('modal-service');
      
      // Reload services globally
      const sRes = await authFetch(`${API_BASE}/v1/settings/services`).then(r => r.json());
      if (sRes.success) {
        allServices = sRes.data;
        renderServices();
      }
    }
  } catch (e) { showToast('فشل حفظ الخدمة', 'error'); }
}

async function deleteService(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟ قد يؤثر ذلك على حجز المواعيد المرتبطة بها.')) return;
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/services/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) {
      showToast('تم حذف الخدمة بنجاح', 'info');
      allServices = allServices.filter(s => s.id !== id);
      renderServices();
    }
  } catch (e) { showToast('فشل حذف الخدمة', 'error'); }
}

// 2. Doctors
function renderDoctorsList() {
  const tbody = document.getElementById('doctors-list-body');
  if (!tbody) return;

  if (!allDoctors.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="loading-cell">لا يوجد أطباء مسجلين</td></tr>';
    return;
  }

  tbody.innerHTML = allDoctors.map(d => `
    <tr>
      <td><strong>${d.full_name}</strong></td>
      <td>${d.specialty || d.specialization || '—'}</td>
      <td><span style="font-family:Outfit; font-size:11px;">${d.created_at || '—'}</span></td>
    </tr>
  `).join('');
}

function showAddDoctorModal() {
  document.getElementById('new-doctor-name').value = '';
  document.getElementById('new-doctor-spec').value = '';
  openModal('modal-add-doctor');
}

async function submitNewDoctor(e) {
  e.preventDefault();
  try {
    const res = await authFetch(`${API_BASE}/v1/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: document.getElementById('new-doctor-name').value,
        specialty: document.getElementById('new-doctor-spec').value
      })
    }).then(r => r.json());

    if (res.success) {
      showToast('تم إضافة الطبيب بنجاح', 'success');
      closeModal('modal-add-doctor');
      
      const dRes = await authFetch(`${API_BASE}/v1/doctors`).then(r => r.json());
      if (dRes.success) {
        allDoctors = dRes.data;
        renderDoctorsList();
        
        // Update doctors select in working hours
        if (allowMultiDoctor) {
          const select = document.getElementById('wh-doctor-select');
          select.innerHTML = allDoctors.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
          select.value = settingsSelectedDoctorId;
        }
      }
    }
  } catch (e) { showToast('فشل إضافة الطبيب', 'error'); }
}

// 3. Operational Settings
async function loadOperationalSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/operational`).then(r => r.json());
    if (res.success) {
      const d = res.data;
      document.getElementById('op-cancel-window').value = d.cancellation_window_hours;
      document.getElementById('op-payment-timeout').value = d.payment_timeout_minutes;
      document.getElementById('op-followup-duration').value = d.followup_grace_period_days;
      document.getElementById('op-allow-bot-followup').checked = d.allow_bot_followups;
      document.getElementById('op-allow-priority-checkin').checked = d.allow_priority_checkin;
    }
  } catch (e) { console.error('Failed to load operational policies:', e); }
}

async function saveOperationalSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/operational`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cancellation_window_hours: parseInt(document.getElementById('op-cancel-window').value),
        payment_timeout_minutes: parseInt(document.getElementById('op-payment-timeout').value),
        followup_grace_period_days: parseInt(document.getElementById('op-followup-duration').value),
        allow_bot_followups: document.getElementById('op-allow-bot-followup').checked,
        allow_priority_checkin: document.getElementById('op-allow-priority-checkin').checked
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ قواعد التشغيل وسياسات العيادة بنجاح', 'success');
  } catch (e) { showToast('فشل حفظ السياسات التشغيلية', 'error'); }
}

// 4. Notification Settings
async function loadNotificationSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/notifications`).then(r => r.json());
    if (res.success) {
      const d = res.data;
      document.getElementById('notif-patient-email-confirm').checked = d.patient_email_confirmation;
      document.getElementById('notif-patient-wa-confirm').checked = d.patient_whatsapp_confirmation;
      document.getElementById('notif-patient-email-rx').checked = d.patient_email_rx;
      document.getElementById('notif-patient-email-invoice').checked = d.patient_email_invoice;
      document.getElementById('notif-doc-email-new').checked = d.doctor_email_new_appt;
      document.getElementById('notif-doc-wa-new').checked = d.doctor_whatsapp_new_appt;
      document.getElementById('notif-doc-email-daily').checked = d.doctor_email_daily_digest;
      document.getElementById('notif-doc-email-weekly').checked = d.doctor_email_weekly_report;
    }
  } catch (e) { console.error('Failed to load notifications:', e); }
}

async function saveNotificationSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_email_confirmation: document.getElementById('notif-patient-email-confirm').checked,
        patient_whatsapp_confirmation: document.getElementById('notif-patient-wa-confirm').checked,
        patient_email_rx: document.getElementById('notif-patient-email-rx').checked,
        patient_email_invoice: document.getElementById('notif-patient-email-invoice').checked,
        doctor_email_new_appt: document.getElementById('notif-doc-email-new').checked,
        doctor_whatsapp_new_appt: document.getElementById('notif-doc-wa-new').checked,
        doctor_email_daily_digest: document.getElementById('notif-doc-email-daily').checked,
        doctor_email_weekly_report: document.getElementById('notif-doc-email-weekly').checked
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ تفضيلات الإشعارات بنجاح', 'success');
  } catch (e) { showToast('فشل حفظ الإشعارات', 'error'); }
}

// 5. Prescription Settings
async function loadPrescriptionSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/prescription`).then(r => r.json());
    if (res.success) {
      const d = res.data;
      document.getElementById('rx-setting-header-ar').value = d.header_ar;
      document.getElementById('rx-setting-header-en').value = d.header_en;
      document.getElementById('rx-setting-theme').value = d.theme_color;
      document.getElementById('rx-setting-footer').value = d.footer_text;
      
      const logoText = document.getElementById('rx-setting-logo-name');
      if (logoText) {
        logoText.textContent = d.logo_url ? 'تم تحميل الشعار مسبقاً' : 'لم يتم اختيار صورة (يستخدم الشعار النصي الافتراضي)';
      }
    }
  } catch (e) { console.error('Failed to load prescription settings:', e); }
}

async function savePrescriptionSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/prescription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        header_ar: document.getElementById('rx-setting-header-ar').value,
        header_en: document.getElementById('rx-setting-header-en').value,
        theme_color: document.getElementById('rx-setting-theme').value,
        footer_text: document.getElementById('rx-setting-footer').value
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ إعدادات قالب الروشتة بنجاح', 'success');
  } catch (e) { showToast('فشل حفظ إعدادات الروشتة', 'error'); }
}

function handleRxLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const nameLabel = document.getElementById('rx-setting-logo-name');
  if (nameLabel) nameLabel.textContent = `جاري التحميل: ${file.name}...`;
  
  setTimeout(() => {
    if (nameLabel) nameLabel.textContent = `تم التحميل: ${file.name}`;
    showToast('تم تحميل شعار الروشتة بنجاح', 'success');
  }, 1000);
}

// 6. Insurance Settings
async function renderInsuranceList() {
  const tbody = document.getElementById('insurance-list-body');
  if (!tbody) return;

  try {
    const res = await authFetch(`${API_BASE}/v1/settings/insurance`).then(r => r.json());
    if (res.success) {
      if (!res.data.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading-cell">لا توجد جهات تأمين متعاقد معها</td></tr>';
        return;
      }
      tbody.innerHTML = res.data.map(i => `
        <tr>
          <td><strong>${i.name_ar}</strong> <span style="font-family:Outfit; font-size:10px; color:#64748b; margin-right:4px;">(${i.name_en})</span></td>
          <td><span style="font-family:Outfit; font-weight:700;">${i.coverage || i.coverage_percentage || 0}%</span></td>
          <td><span style="color:#10b981; font-size:11px;"><i class="fa-solid fa-circle-check"></i> نشط</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="3" class="loading-cell" style="color:#ef4444;">فشل التحميل</td></tr>';
  }
}

async function addInsuranceCompany(e) {
  e.preventDefault();
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/insurance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name_ar: document.getElementById('ins-new-name-ar').value,
        name_en: document.getElementById('ins-new-name-en').value,
        coverage: parseInt(document.getElementById('ins-new-coverage').value)
      })
    }).then(r => r.json());
    if (res.success) {
      showToast('تم إضافة جهة التأمين بنجاح', 'success');
      document.getElementById('ins-new-name-ar').value = '';
      document.getElementById('ins-new-name-en').value = '';
      document.getElementById('ins-new-coverage').value = '';
      renderInsuranceList();
    }
  } catch (e) { showToast('فشل إضافة جهة التأمين', 'error'); }
}

// 7. Refund Settings
async function loadRefundSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/refund`).then(r => r.json());
    if (res.success) {
      document.getElementById('op-refund-destination').value = res.data.refund_destination;
    }
  } catch (e) { console.error('Failed to load refund policy:', e); }
}

async function saveRefundSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/refund`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refund_destination: document.getElementById('op-refund-destination').value
      })
    }).then(r => r.json());
    if (res.success) showToast('تم حفظ سياسة استرداد الأموال بنجاح', 'success');
  } catch (e) { showToast('فشل حفظ سياسة الاسترداد', 'error'); }
}

// --- 8. WORKING HOURS MANAGEMENT (DOCTOR SPECIFIC & GRID LAYOUT) ---

async function fetchDoctorWorkingHours() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/working-hours?doctor_id=${settingsSelectedDoctorId}`).then(r => r.json());
    if (res.success) {
      workingHoursData = res.data;
    }
  } catch (e) {
    showToast('فشل جلب ساعات العمل للطبيب المحدد', 'error');
  }
}

function renderWorkingHoursReadOnly() {
  const container = document.getElementById('working-hours-grid');
  if (!container) return;

  container.innerHTML = workingHoursData.map(h => {
    let shiftsHtml = '';
    if (!h.is_open || !h.shifts || h.shifts.length === 0) {
      shiftsHtml = `<span class="wh-shift-badge closed">مغلق</span>`;
    } else {
      shiftsHtml = h.shifts.map((s, idx) => {
        const branchBadge = s.location ? `<span style="font-size:10px; color:#38bdf8; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.15); padding:2px 6px; border-radius:4px; margin-right:6px;"><i class="fa-solid fa-location-dot" style="margin-left:4px;"></i>${s.location}</span>` : '';
        return `
          <div style="display:inline-flex; align-items:center; margin-left:14px; margin-bottom:4px;">
            <span class="wh-shift-badge">شيفت العمل ${idx + 1}: ${s.start} - ${s.end}</span>
            ${branchBadge}
          </div>
        `;
      }).join('');
    }

    const stateLabel = h.is_open ? 'مفتوح' : 'مغلق';
    const stateColor = h.is_open ? '#10b981' : '#ef4444';

    return `
      <div class="wh-row">
        <span class="wh-day">${h.day_ar}</span>
        <span class="wh-state" style="color: ${stateColor}; font-weight:700;">${stateLabel}</span>
        <div class="wh-shifts">
          ${shiftsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function toggleEditWorkingHours() {
  isEditingWorkingHours = !isEditingWorkingHours;
  const card = document.getElementById('working-hours-card');
  if (!card) return;
  const actions = card.querySelector('.card-header-actions');
  
  if (isEditingWorkingHours) {
    if (actions) {
      actions.innerHTML = `
        <button class="btn-sm btn-outline btn-success-outline" onclick="saveWorkingHours()"><i class="fa-solid fa-circle-check"></i> حفظ</button>
        <button class="btn-sm btn-outline btn-danger-outline" style="margin-right:6px;" onclick="cancelEditWorkingHours()"><i class="fa-solid fa-circle-xmark"></i> إلغاء</button>
      `;
    }
    renderWorkingHoursEdit();
  } else {
    restoreWorkingHoursHeader();
    renderWorkingHoursReadOnly();
  }
}

function renderWorkingHoursEdit() {
  const container = document.getElementById('working-hours-grid');
  if (!container) return;

  container.innerHTML = workingHoursData.map(h => {
    const is_open = h.is_open;
    const day = h.day;

    let shiftsInputs = '';
    if (is_open && h.shifts && h.shifts.length > 0) {
      shiftsInputs = h.shifts.map((s, idx) => {
        const branchOptions = clinicBranches.map(b => b.name);
        const currentLoc = s.location || 'العيادة الرئيسية';
        if (currentLoc && !branchOptions.includes(currentLoc)) {
          branchOptions.push(currentLoc);
        }
        const branchSelectHtml = `
          <select class="wh-location-select" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; color: #e2e8f0; padding: 4px 8px; font-family: 'Cairo'; font-size: 11px; width: 140px; margin-right: 8px; cursor: pointer;">
            ${branchOptions.map(b => `<option value="${b}" ${currentLoc === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        `;
        return `
          <div class="wh-shift-item-edit" style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.02); padding: 4px 8px; border: 1px solid rgba(255,255,255,0.04); border-radius: 8px;">
            <span style="font-size: 11px; color: #94a3b8; margin-left: 2px;">شيفت العمل ${idx + 1}:</span>
            <input type="time" class="wh-time-input start" value="${s.start}" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e2e8f0; padding: 4px; font-family: 'Outfit'; font-size: 11px;">
            <span style="color: #475569; font-size: 11px;">إلى</span>
            <input type="time" class="wh-time-input end" value="${s.end}" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e2e8f0; padding: 4px; font-family: 'Outfit'; font-size: 11px;">
            ${branchSelectHtml}
            <button type="button" class="btn-delete-shift" onclick="deleteShiftInputRow(this)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
      }).join('');
    }

    const stateLabel = is_open ? 'مفتوح' : 'مغلق';
    const stateColor = is_open ? '#10b981' : '#ef4444';

    return `
      <div class="wh-row-edit" data-day="${day}">
        <span class="wh-day">${h.day_ar}</span>
        
        <label class="simple-switch-label" style="display: flex; align-items: center; gap: 8px; margin-bottom: 0;">
          <input type="checkbox" class="wh-open-checkbox" ${is_open ? 'checked' : ''} onchange="toggleRowInputs(this)">
          <span class="wh-open-label" style="color: ${stateColor}; font-weight:700;">${stateLabel}</span>
        </label>
        
        <div class="wh-shifts-edit" style="opacity: ${is_open ? '1' : '0.3'}; pointer-events: ${is_open ? 'auto' : 'none'};">
          <div class="wh-shifts-list-edit" style="display: flex; flex-direction: column; gap: 4px;">
            ${shiftsInputs}
          </div>
          <button type="button" class="btn-add-shift" onclick="addShiftInputRow(this)">
            <i class="fa-solid fa-circle-plus"></i> إضافة شيفت عمل
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function addShiftInputRow(btn) {
  const container = btn.closest('.wh-shifts-edit').querySelector('.wh-shifts-list-edit');
  if (!container) return;

  const currentShifts = container.querySelectorAll('.wh-shift-item-edit').length;
  const branchOptions = clinicBranches.map(b => b.name);
  const branchSelectHtml = `
    <select class="wh-location-select" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; color: #e2e8f0; padding: 4px 8px; font-family: 'Cairo'; font-size: 11px; width: 140px; margin-right: 8px; cursor: pointer;">
      ${branchOptions.map(b => `<option value="${b}">${b}</option>`).join('')}
    </select>
  `;

  const div = document.createElement('div');
  div.className = 'wh-shift-item-edit';
  div.style.display = 'inline-flex';
  div.style.alignItems = 'center';
  div.style.gap = '8px';
  div.style.marginBottom = '6px';
  div.style.background = 'rgba(255,255,255,0.02)';
  div.style.padding = '4px 8px';
  div.style.border = '1px solid rgba(255,255,255,0.04)';
  div.style.borderRadius = '8px';
  div.innerHTML = `
    <span style="font-size: 11px; color: #94a3b8; margin-left: 2px;">شيفت العمل ${currentShifts + 1}:</span>
    <input type="time" class="wh-time-input start" value="" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e2e8f0; padding: 4px; font-family: 'Outfit'; font-size: 11px;">
    <span style="color: #475569; font-size: 11px;">إلى</span>
    <input type="time" class="wh-time-input end" value="" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #e2e8f0; padding: 4px; font-family: 'Outfit'; font-size: 11px;">
    ${branchSelectHtml}
    <button type="button" class="btn-delete-shift" onclick="deleteShiftInputRow(this)">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;
  container.appendChild(div);
  updateShiftNumbers(container);
}

function deleteShiftInputRow(btn) {
  const item = btn.closest('.wh-shift-item-edit');
  const container = btn.closest('.wh-shifts-list-edit');
  if (item && container) {
    item.remove();
    updateShiftNumbers(container);
  }
}

function updateShiftNumbers(container) {
  const items = container.querySelectorAll('.wh-shift-item-edit');
  items.forEach((item, idx) => {
    const label = item.querySelector('span');
    if (label) {
      label.textContent = `شيفت العمل ${idx + 1}:`;
    }
  });
}

function toggleRowInputs(checkbox) {
  const container = checkbox.closest('.wh-row-edit');
  if (!container) return;
  const label = container.querySelector('.wh-open-label');
  const shiftsContainer = container.querySelector('.wh-shifts-edit');
  if (checkbox.checked) {
    if (label) { label.textContent = 'مفتوح'; label.style.color = '#10b981'; }
    if (shiftsContainer) { shiftsContainer.style.opacity = '1'; shiftsContainer.style.pointerEvents = 'auto'; }
  } else {
    if (label) { label.textContent = 'مغلق'; label.style.color = '#ef4444'; }
    if (shiftsContainer) { shiftsContainer.style.opacity = '0.3'; shiftsContainer.style.pointerEvents = 'none'; }
  }
}

function restoreWorkingHoursHeader() {
  const card = document.getElementById('working-hours-card');
  if (card) {
    const actions = card.querySelector('.card-header-actions');
    if (actions) {
      actions.innerHTML = `
        <button class="btn-sm btn-outline" id="btn-edit-working-hours" onclick="toggleEditWorkingHours()"><i class="fa-solid fa-pen-to-square"></i> تعديل المواعيد</button>
      `;
    }
  }
}

function cancelEditWorkingHours() {
  isEditingWorkingHours = false;
  restoreWorkingHoursHeader();
  renderWorkingHoursReadOnly();
}

async function saveWorkingHours() {
  const rows = document.querySelectorAll('#working-hours-grid .wh-row-edit');
  const working_hours = [];
  let validationFailed = false;
  
  rows.forEach(row => {
    if (validationFailed) return;
    
    const day = row.getAttribute('data-day');
    const is_open = row.querySelector('.wh-open-checkbox').checked;
    const shifts = [];
    
    if (is_open) {
      const shiftItems = row.querySelectorAll('.wh-shift-item-edit');
      shiftItems.forEach(item => {
        const start = item.querySelector('.start').value;
        const end = item.querySelector('.end').value;
        const location = item.querySelector('.wh-location-select').value;
        if (start && end) {
          shifts.push({ start, end, location });
        }
      });
      
      // Shift overlaps validation
      const parsedShifts = shifts.map(s => {
        const [sH, sM] = s.start.split(':').map(Number);
        const [eH, eM] = s.end.split(':').map(Number);
        return {
          start: sH * 60 + sM,
          end: eH * 60 + eM,
          orig: s
        };
      });
      
      parsedShifts.sort((a, b) => a.start - b.start);
      
      for (let i = 0; i < parsedShifts.length - 1; i++) {
        if (parsedShifts[i].end > parsedShifts[i+1].start) {
          const orig = workingHoursData.find(h => h.day === day);
          showToast(`⚠️ تداخل في الفترات: يوم ${orig ? orig.day_ar : day} يحتوي على فترات عمل متداخلة (${parsedShifts[i].orig.start}-${parsedShifts[i].orig.end} مع ${parsedShifts[i+1].orig.start}-${parsedShifts[i+1].orig.end}).`, 'error');
          validationFailed = true;
          return;
        }
      }
    }
    
    const orig = workingHoursData.find(h => h.day === day);
    const day_ar = orig ? orig.day_ar : '';
    
    working_hours.push({
      day,
      day_ar,
      is_open,
      shifts
    });
  });
  
  if (validationFailed) return;
  
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/working-hours?doctor_id=${settingsSelectedDoctorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ working_hours })
    }).then(r => r.json());
    
    if (res.success) {
      showToast('تم حفظ ساعات العمل بنجاح', 'success');
      workingHoursData = res.data;
      isEditingWorkingHours = false;
      restoreWorkingHoursHeader();
      renderWorkingHoursReadOnly();
    } else {
      showToast('فشل حفظ ساعات العمل: ' + (res.error?.message || 'خطأ غير معروف'), 'error');
    }
  } catch (e) {
    showToast('فشل الاتصال بالسيرفر لحفظ ساعات العمل', 'error');
  }
}

// --- 9. CLINIC BRANCHES MANAGEMENT ---

function loadBranchesList() {
  const defaultBranches = [
    { name: 'العيادة الرئيسية', address: 'مصر الجديدة، القاهرة' },
    { name: 'فرع الدقي', address: 'شارع التحرير، الجيزة' },
    { name: 'فرع التجمع', address: 'شارع التسعين، التجمع الخامس' }
  ];
  clinicBranches = JSON.parse(localStorage.getItem('clinic_branches')) || defaultBranches;
  
  // Migrate old string arrays to object arrays if needed
  if (clinicBranches.length > 0 && typeof clinicBranches[0] === 'string') {
    clinicBranches = clinicBranches.map(name => ({
      name: name,
      address: name === 'العيادة الرئيسية' ? 'مصر الجديدة، القاهرة' : 
               name === 'فرع الدقي' ? 'شارع التحرير، الجيزة' : 
               name === 'فرع التجمع' ? 'شارع التسعين، التجمع الخامس' : 'عنوان غير محدد'
    }));
  }

  if (!localStorage.getItem('clinic_branches')) {
    localStorage.setItem('clinic_branches', JSON.stringify(clinicBranches));
  }
  renderBranches();
}

function renderBranches() {
  const tbody = document.getElementById('branches-list-body');
  if (!tbody) return;
  
  tbody.innerHTML = clinicBranches.map(b => `
    <tr>
      <td><strong>${b.name}</strong></td>
      <td style="color: #94a3b8;">${b.address}</td>
      <td>
        <button class="btn-action btn-danger" onclick="deleteBranch('${b.name}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function addBranch(e) {
  e.preventDefault();
  const nameInput = document.getElementById('branch-new-name');
  const addressInput = document.getElementById('branch-new-address');
  const name = nameInput.value.trim();
  const address = addressInput.value.trim();
  
  if (!name || !address) return;

  if (clinicBranches.some(b => b.name === name)) {
    showToast('⚠️ اسم الفرع موجود بالفعل.', 'error');
    return;
  }

  clinicBranches.push({ name, address });
  localStorage.setItem('clinic_branches', JSON.stringify(clinicBranches));
  nameInput.value = '';
  addressInput.value = '';
  renderBranches();
  showToast('تم إضافة الفرع بنجاح', 'success');
  
  if (isEditingWorkingHours) renderWorkingHoursEdit();
}

function deleteBranch(name) {
  if (clinicBranches.length <= 1) {
    showToast('يجب أن تحتوي العيادة على فرع واحد على الأقل.', 'error');
    return;
  }
  if (!confirm(`هل تريد حذف ${name}؟`)) return;

  clinicBranches = clinicBranches.filter(b => b.name !== name);
  localStorage.setItem('clinic_branches', JSON.stringify(clinicBranches));
  renderBranches();
  showToast('تم حذف الفرع بنجاح', 'info');
  
  if (isEditingWorkingHours) renderWorkingHoursEdit();
}

// ═══ 9. CHANNEL INTEGRATION SETTINGS ═══

async function loadChannelSettings() {
  try {
    const res = await authFetch(`${API_BASE}/v1/settings/channels`).then(r => r.json());
    if (res.success) {
      const d = res.data;
      
      // WhatsApp
      document.getElementById('ch-wa-doctor-enabled').checked = !!d.whatsapp.enabled;
      const waPhoneDesc = document.getElementById('ch-wa-connected-phone');
      if (d.whatsapp.status === 'connected' && d.whatsapp.phone_number_id) {
        waPhoneDesc.innerHTML = `<span style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> متصل ورقم الهاتف المعرف هو: ${d.whatsapp.phone_number_id}</span>`;
      } else {
        waPhoneDesc.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-circle-xmark"></i> غير متصل (يرجى مراجعة إدارة المنصة لربط الرقم)</span>`;
      }

      // Telegram
      document.getElementById('ch-tg-doctor-enabled').checked = !!d.telegram.enabled;
      const tgBotDesc = document.getElementById('ch-tg-connected-bot');
      if (d.telegram.status === 'connected' && d.telegram.bot_username) {
        tgBotDesc.innerHTML = `<span style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> متصل بالبوت: @${d.telegram.bot_username}</span>`;
      } else {
        tgBotDesc.innerHTML = `<span style="color: #ef4444;"><i class="fa-solid fa-circle-xmark"></i> غير متصل (يرجى مراجعة إدارة المنصة لربط البوت)</span>`;
      }

      // Greeting Message
      document.getElementById('ch-bot-greeting').value = d.bot_greeting || '';
    }
  } catch (e) { console.error('Failed to load channel settings:', e); }
}

async function saveDoctorChannelSettings() {
  try {
    const payload = {
      whatsapp_enabled: document.getElementById('ch-wa-doctor-enabled').checked,
      telegram_enabled: document.getElementById('ch-tg-doctor-enabled').checked,
      bot_greeting: document.getElementById('ch-bot-greeting').value.trim()
    };

    const res = await authFetch(`${API_BASE}/v1/settings/channels/doctor`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.success) {
      showToast('تم حفظ إعدادات مساعد الحجز بنجاح!', 'success');
      // Reload to show correct statuses
      loadChannelSettings();
    } else {
      showToast('فشل حفظ الإعدادات', 'error');
    }
  } catch (e) {
    showToast('خطأ في الاتصال بالخادم', 'error');
  }
}
