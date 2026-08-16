// Patients Page Specific Logic
document.addEventListener('sharedDataReady', () => {
  initPatientsPage();
});

function initPatientsPage() {
  renderPatientsList(allPatients);

  // If page is loaded with a patient ID query param (e.g. ?id=xxx), open profile immediately
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id');
  if (targetId) {
    openPatientProfile(targetId);
  }
}

function renderPatientsList(patients) {
  const tbody = document.getElementById('patients-list-body');
  if (!tbody) return;

  if (!patients.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state-card" style="padding: 40px 20px; text-align: center;">
            <i class="fa-solid fa-users-slash" style="font-size: 40px; color: var(--scs-text-dim); margin-bottom: 12px; display: block;"></i>
            <h3 style="font-size: 15px; color: var(--scs-text-heading); margin-bottom: 6px;">لا يوجد مرضى</h3>
            <p style="font-size: 12px; color: var(--scs-text-muted); max-width: 320px; margin: 0 auto;">لا توجد أي نتائج مطابقة لبحثك في ملفات المرضى المسجلة.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const genderAr = { male: 'ذكر', female: 'أنثى', '': '—', null: '—' };

  tbody.innerHTML = patients.map(p => {
    return `
      <tr class="animate-fade-in">
        <td><strong>${p.full_name}</strong></td>
        <td><span style="font-family: Outfit; font-weight: 600;">${p.phone}</span></td>
        <td>${p.age || '—'}</td>
        <td>${genderAr[p.gender] || '—'}</td>
        <td><span style="font-family: Outfit; font-size:12px; color: var(--scs-text-muted);">${p.email || '—'}</span></td>
        <td>${p.last_visit_at ? formatDate(p.last_visit_at) : '—'}</td>
        <td>
          <button class="btn-action btn-info" onclick="openPatientProfile('${p.id}')">
            <i class="fa-solid fa-folder-open"></i> الملف الطبي
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function showTableLoading() {
  const tbody = document.getElementById('patients-list-body');
  if (!tbody) return;
  
  tbody.innerHTML = Array(5).fill(0).map(() => `
    <tr>
      <td><div class="skeleton" style="height: 18px; width: 140px;"></div></td>
      <td><div class="skeleton" style="height: 16px; width: 100px;"></div></td>
      <td><div class="skeleton" style="height: 16px; width: 30px;"></div></td>
      <td><div class="skeleton" style="height: 16px; width: 40px;"></div></td>
      <td><div class="skeleton" style="height: 16px; width: 160px;"></div></td>
      <td><div class="skeleton" style="height: 16px; width: 90px;"></div></td>
      <td><div class="skeleton" style="height: 28px; width: 100px; border-radius: 6px;"></div></td>
    </tr>
  `).join('');
}

function filterPatientsList() {
  const query = document.getElementById('patient-search-input').value.trim().toLowerCase();
  if (!query) {
    renderPatientsList(allPatients);
    return;
  }

  const filtered = allPatients.filter(p => 
    p.full_name.toLowerCase().includes(query) || 
    p.phone.includes(query) ||
    (p.email && p.email.toLowerCase().includes(query))
  );
  renderPatientsList(filtered);
}

function showAddPatientModal() {
  document.getElementById('new-patient-name').value = '';
  document.getElementById('new-patient-phone').value = '';
  document.getElementById('new-patient-age').value = '';
  document.getElementById('new-patient-gender').value = '';
  document.getElementById('new-patient-email').value = '';
  openModal('modal-add-patient');
}

async function submitNewPatient(e) {
  e.preventDefault();
  try {
    const res = await ScsApi.createPatient({
      full_name: document.getElementById('new-patient-name').value,
      phone: document.getElementById('new-patient-phone').value,
      age: parseInt(document.getElementById('new-patient-age').value) || null,
      gender: document.getElementById('new-patient-gender').value || null,
      email: document.getElementById('new-patient-email').value || null
    });

    if (res.success) {
      showToast('تم إضافة المريض بنجاح', 'success');
      closeModal('modal-add-patient');
      
      // Reload patients globally and locally
      showTableLoading();
      const pRes = await ScsApi.getPatients();
      if (pRes.success) {
        allPatients = pRes.data.patients;
        renderPatientsList(allPatients);
        
        // Update patients count badge in sidebar
        const patBadge = document.getElementById('patients-count-badge');
        if (patBadge) patBadge.textContent = allPatients.length;
      }
    }
  } catch (e) {
    showToast('فشل إضافة المريض', 'error');
  }
}

async function openPatientProfile(patientId) {
  const panel = document.getElementById('patient-profile-panel');
  const body = document.getElementById('patient-profile-body');
  
  if (!panel || !body) return;

  panel.classList.add('open');
  
  // Render Shimmery Profile skeleton
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="profile-info-grid">
        <div class="profile-info-item"><div class="skeleton" style="height: 12px; width: 60px; margin-bottom: 8px;"></div><div class="skeleton" style="height: 18px; width: 120px;"></div></div>
        <div class="profile-info-item"><div class="skeleton" style="height: 12px; width: 60px; margin-bottom: 8px;"></div><div class="skeleton" style="height: 18px; width: 50px;"></div></div>
        <div class="profile-info-item"><div class="skeleton" style="height: 12px; width: 60px; margin-bottom: 8px;"></div><div class="skeleton" style="height: 18px; width: 40px;"></div></div>
        <div class="profile-info-item"><div class="skeleton" style="height: 12px; width: 60px; margin-bottom: 8px;"></div><div class="skeleton" style="height: 18px; width: 140px;"></div></div>
      </div>
      <div class="skeleton" style="height: 20px; width: 160px; margin-top: 10px;"></div>
      <div class="skeleton" style="height: 70px; border-radius: 10px; width: 100%;"></div>
      <div class="skeleton" style="height: 70px; border-radius: 10px; width: 100%;"></div>
    </div>
  `;

  try {
    const res = await ScsApi.getPatient(patientId);
    if (res.success) {
      renderPatientProfile(res.data);
    } else {
      body.innerHTML = `<div style="padding:20px; color:var(--scs-danger); text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> خطأ في تحميل ملف المريض</div>`;
    }
  } catch (e) {
    body.innerHTML = `<div style="padding:20px; color:var(--scs-danger); text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> خطأ في الاتصال بالخادم</div>`;
  }
}

function closePatientProfile() {
  const panel = document.getElementById('patient-profile-panel');
  if (panel) panel.classList.remove('open');
}

function renderPatientProfile(data) {
  const p = data.patient;
  const history = data.medical_records || [];
  const body = document.getElementById('patient-profile-body');
  const nameEl = document.getElementById('patient-profile-name');
  
  if (nameEl) nameEl.textContent = `الملف الطبي: ${p.full_name}`;
  if (!body) return;

  const genderAr = { male: 'ذكر', female: 'أنثى', '': '—', null: '—' };

  let recordsHtml = '';
  if (!history.length) {
    recordsHtml = `
      <div class="empty-state-card" style="padding: 20px; text-align: center; border: 1px dashed var(--scs-border-subtle); border-radius: 10px; background: rgba(255,255,255,0.01);">
        <i class="fa-solid fa-notes-medical" style="font-size: 24px; color: var(--scs-text-dim); margin-bottom: 8px; display: block;"></i>
        <p style="color: var(--scs-text-muted); font-style: italic; font-size: 12px; margin: 0;">لا توجد زيارات طبية سابقة مسجلة.</p>
      </div>
    `;
  } else {
    recordsHtml = history.map(rec => {
      let items = rec.prescription_items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
      }
      if (!Array.isArray(items)) items = [];

      // Parse dental_records
      let dental = rec.dental_records;
      if (typeof dental === 'string') {
        try { dental = JSON.parse(dental); } catch(e) { dental = {}; }
      }
      if (!dental || typeof dental !== 'object') dental = {};

      // Parse objective (vitals)
      let vitals = rec.objective;
      if (typeof vitals === 'string') {
        try { vitals = JSON.parse(vitals); } catch(e) { vitals = {}; }
      }
      if (!vitals || typeof vitals !== 'object') vitals = {};

      // Build mini chart HTML (teeth or bones)
      const chartKeys = Object.keys(dental);
      let miniChartHtml = '';
      if (chartKeys.length > 0) {
        const isNumeric = chartKeys.some(k => !isNaN(parseInt(k)));
        if (isNumeric) {
          // Dental
          const statusAr = { healthy: 'سليم', filling: 'حشو', endo: 'علاج عصب', extracted: 'خلع', crown: 'تركيبة', implant: 'زراعة' };
          let teethTags = chartKeys.map(num => {
            const st = dental[num];
            return `<span class="mini-tooth st-${st}" title="سن #${num}: ${statusAr[st] || st}"></span>`;
          }).join('');
          let teethList = chartKeys.map(num => {
            const st = dental[num];
            return `سن #${num}: <strong>${statusAr[st] || st}</strong>`;
          }).join(' · ');
          miniChartHtml = `
            <div style="margin-top: 8px; padding: 10px 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
              <strong style="color: #0369a1; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13px;">
                <i class="fa-solid fa-tooth"></i> حالة الأسنان المسجلة:
              </strong>
              <div class="mini-odontogram">${teethTags}</div>
              <div style="font-size: 11px; color: #475569; line-height: 1.6;">${teethList}</div>
            </div>
          `;
        } else {
          // Orthopedic
          const orthoAr = { healthy: 'سليم', fracture: 'كسر', inflammation: 'التهاب', osteoarthritis: 'خشونة', cartilage: 'تآكل غضروف', surgery: 'جراحة سابقة' };
          const boneNamesAr = {
            skull: 'الجمجمة', cervical_spine: 'الفقرات العنقية', thoracic_spine: 'الفقرات الصدرية', lumbar_spine: 'الفقرات القطنية',
            sternum: 'عظمة القص', ribs_right: 'الأضلاع اليمنى', ribs_left: 'الأضلاع اليسرى', pelvis: 'عظام الحوض',
            clavicle_right: 'الترقوة اليمنى', clavicle_left: 'الترقوة اليسرى', shoulder_right: 'الكتف الأيمن', shoulder_left: 'الكتف الأيسر',
            humerus_right: 'العضد الأيمن', humerus_left: 'العضد الأيسر', elbow_right: 'الكوع الأيمن', elbow_left: 'الكوع الأيسر',
            forearm_right: 'الساعد الأيمن', forearm_left: 'الساعد الأيسر', wrist_right: 'الرسغ واليد اليمنى', wrist_left: 'الرسغ واليد اليسرى',
            hip_right: 'الفخذ الأيمن', hip_left: 'الفخذ الأيسر', femur_right: 'عظمة الفخذ اليمنى', femur_left: 'عظمة الفخذ اليسرى',
            knee_right: 'الركبة اليمنى', knee_left: 'الركبة اليسرى', tibia_right: 'الساق اليمنى', tibia_left: 'الساق اليسرى',
            ankle_right: 'الكاحل والقدم اليمنى', ankle_left: 'الكاحل والقدم اليسرى'
          };
          let bonesList = chartKeys.map(k => {
            const st = dental[k];
            const bName = boneNamesAr[k] || k;
            return `🦴 ${bName}: <strong>${orthoAr[st] || st}</strong>`;
          }).join(' · ');
          miniChartHtml = `
            <div style="margin-top: 8px; padding: 10px 12px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px;">
              <strong style="color: #c2410c; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13px;">
                <i class="fa-solid fa-bone"></i> فحص الهيكل العظمي والمفاصل:
              </strong>
              <div style="font-size: 11px; color: #7c2d12; line-height: 1.6;">${bonesList}</div>
            </div>
          `;
        }
      }

      // Build vitals HTML
      let vitalsHtml = '';
      if (vitals.blood_pressure || vitals.pulse || vitals.temperature || vitals.weight) {
        vitalsHtml = `
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px;">
            ${vitals.blood_pressure ? `<span style="font-size: 11px; background: #fffbeb; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 4px; color: #92400e;">🩺 ضغط: <strong>${vitals.blood_pressure}</strong></span>` : ''}
            ${vitals.pulse ? `<span style="font-size: 11px; background: #fef2f2; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 4px; color: #991b1b;">💓 نبض: <strong>${vitals.pulse}</strong></span>` : ''}
            ${vitals.temperature ? `<span style="font-size: 11px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 4px; color: #166534;">🌡️ حرارة: <strong>${vitals.temperature}°</strong></span>` : ''}
            ${vitals.weight ? `<span style="font-size: 11px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 4px; color: #1e40af;">⚖️ وزن: <strong>${vitals.weight} كجم</strong></span>` : ''}
          </div>
        `;
      }

      return `
        <div class="visit-timeline-item animate-slide-up" style="background:#f8fafc; border:1px solid #e2e8f0; border-right:4px solid #2563eb; border-radius:10px; padding:14px; margin-bottom:12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
            <span style="font-weight: 700; color: #2563eb; font-size: 13px;"><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i>زيارة: ${rec.created_at ? formatDate(rec.created_at) : '—'}</span>
            <span style="font-size: 12px; color: #64748b;"><i class="fa-solid fa-user-doctor" style="margin-left: 4px;"></i>${rec.doctor_name || 'د. محمد نور'}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #334155; line-height: 1.6;">
            <div><strong style="color: #0f172a; margin-left: 4px;">الشكوى (Subjective):</strong> ${rec.subjective || '—'}</div>
            ${vitalsHtml}
            <div><strong style="color: #0f172a; margin-left: 4px;">التشخيص (Assessment):</strong> ${rec.diagnosis_icd11 || '—'}</div>
            <div><strong style="color: #0f172a; margin-left: 4px;">الخطة العلاجية (Plan):</strong> ${rec.plan || '—'}</div>
            ${miniChartHtml}
            ${items.length > 0 ? `
              <div style="margin-top: 8px; padding: 10px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
                <strong style="color: #059669; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 13px;">
                  <i class="fa-solid fa-prescription-bottle-medical"></i> الأدوية الموصوفة:
                </strong>
                <div style="padding-right: 8px; color: #047857; font-size: 12px;">
                  ${items.map(pr => `• <strong>${pr.medication_name || pr.name}</strong> ${pr.dosage ? '(' + pr.dosage + ')' : ''} ${pr.duration ? '— لمدة ' + pr.duration : ''}`).join('<br>')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  body.innerHTML = `
    <!-- Patient Info Grid -->
    <div class="profile-info-grid animate-fade-in">
      <div class="profile-info-item">
        <label>الهاتف</label>
        <span style="font-family: Outfit; font-weight: 600;">${p.phone}</span>
      </div>
      <div class="profile-info-item">
        <label>السن</label>
        <span>${p.age || '—'} سنة</span>
      </div>
      <div class="profile-info-item">
        <label>الجنس</label>
        <span>${genderAr[p.gender] || '—'}</span>
      </div>
      <div class="profile-info-item">
        <label>البريد الإلكتروني</label>
        <span style="font-family: Outfit; font-size: 11px; color: var(--scs-text-muted);">${p.email || '—'}</span>
      </div>
    </div>
    
    <!-- Medical History -->
    <h3 class="profile-section-title animate-fade-in"><i class="fa-solid fa-notes-medical"></i>التاريخ الطبي والزيارات السابقة</h3>
    <div style="margin-top: 10px;">
      ${recordsHtml}
    </div>
  `;
}
