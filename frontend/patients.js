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
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">لا يوجد مرضى مطابقين للبحث</td></tr>';
    return;
  }

  tbody.innerHTML = patients.map(p => {
    const genderAr = { male: 'ذكر', female: 'أنثى', '': '—' };
    return `
      <tr>
        <td><strong>${p.full_name}</strong></td>
        <td><span style="font-family: Outfit;">${p.phone}</span></td>
        <td>${p.age || '—'}</td>
        <td>${genderAr[p.gender] || '—'}</td>
        <td><span style="font-family: Outfit; font-size:11px;">${p.email || '—'}</span></td>
        <td>${p.last_visit || '—'}</td>
        <td>
          <button class="btn-action btn-outline-cta" onclick="openPatientProfile('${p.id}')">
            <i class="fa-solid fa-folder-open"></i> الملف الطبي
          </button>
        </td>
      </tr>
    `;
  }).join('');
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
    const res = await fetch(`${API_BASE}/v1/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: document.getElementById('new-patient-name').value,
        phone: document.getElementById('new-patient-phone').value,
        age: parseInt(document.getElementById('new-patient-age').value) || null,
        gender: document.getElementById('new-patient-gender').value || null,
        email: document.getElementById('new-patient-email').value || null
      })
    }).then(r => r.json());

    if (res.success) {
      showToast('تم إضافة المريض بنجاح', 'success');
      closeModal('modal-add-patient');
      
      // Reload patients globally and locally
      const pRes = await fetch(`${API_BASE}/v1/patients`).then(r => r.json());
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
  body.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

  try {
    const res = await fetch(`${API_BASE}/v1/patients/${patientId}`).then(r => r.json());
    if (res.success) {
      renderPatientProfile(res.data);
    } else {
      body.innerHTML = `<div style="padding:20px; color:#ef4444;">خطأ في تحميل ملف المريض</div>`;
    }
  } catch (e) {
    body.innerHTML = `<div style="padding:20px; color:#ef4444;">خطأ في الاتصال بالخادم</div>`;
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

  const genderAr = { male: 'ذكر', female: 'أنثى', '': '—' };

  let recordsHtml = '';
  if (!history.length) {
    recordsHtml = '<div class="no-records-info" style="color: var(--scs-text-muted); font-style: italic; font-size: 12px; padding: 10px;">لا توجد سجلات طبية سابقة لهذا المريض.</div>';
  } else {
    recordsHtml = history.map(rec => `
      <div class="visit-timeline-item">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid var(--scs-border-light); padding-bottom: 6px;">
          <span style="font-weight: 700; color: var(--scs-primary-light); font-size: 12px;">زيارة: ${rec.visit_date}</span>
          <span style="font-size: 11px; color: var(--scs-text-label);"><i class="fa-solid fa-user-doctor" style="margin-left: 4px;"></i>${rec.doctor_name || 'د. محمد نور'}</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 11px; color: var(--scs-text);">
          <div><strong style="color: var(--scs-text-bright);">التشخيص والشكوى (S/O):</strong> ${rec.subjective || '—'}</div>
          <div><strong style="color: var(--scs-text-bright);">الخطة العلاجية (Plan):</strong> ${rec.treatment_plan || '—'}</div>
          ${rec.prescriptions && rec.prescriptions.length ? `
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--scs-border-light);">
              <strong style="color: var(--scs-success);"><i class="fa-solid fa-capsules" style="margin-left: 4px;"></i>الأدوية الموصوفة:</strong>
              <div style="padding-right: 8px; margin-top: 2px;">
                ${rec.prescriptions.map(pr => `• ${pr.med_name} (${pr.dose})`).join('<br>')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  body.innerHTML = `
    <!-- Patient Info Grid -->
    <div class="profile-info-grid">
      <div class="profile-info-item">
        <label>الهاتف</label>
        <span style="font-family: Outfit;">${p.phone}</span>
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
        <span style="font-family: Outfit; font-size: 11px;">${p.email || '—'}</span>
      </div>
    </div>
    
    <!-- Medical History -->
    <h3 class="profile-section-title"><i class="fa-solid fa-notes-medical"></i>التاريخ الطبي والزيارات السابقة</h3>
    <div style="margin-top: 10px;">
      ${recordsHtml}
    </div>
  `;
}
