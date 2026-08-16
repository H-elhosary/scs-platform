// Exam Room / SOAP Page Specific Logic
let currentExamAppointment = null;
let lastPrescriptionData = null;

document.addEventListener('sharedDataReady', () => {
  initExamPage();
});

async function initExamPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const apptId = urlParams.get('appointment_id');
  
  if (!apptId) {
    showToast('⚠️ لم يتم اختيار موعد كشف صالح.', 'error');
    setTimeout(() => { location.href = 'dashboard.html'; }, 1500);
    return;
  }

  currentExamAppointment = apptId;
  await loadExamData(apptId);
}

async function loadExamData(apptId) {
  try {
    const res = await fetch(`${API_BASE}/v1/appointments`).then(r => r.json());
    if (res.success) {
      const apt = res.data.find(a => a.id === apptId);
      if (apt) {
        document.getElementById('exam-patient-info').innerHTML = `
          المريض: <strong style="color:#f8fafc;">${apt.patient_name}</strong> 
          — نوع الزيارة: <strong>${apt.visit_type === 'exam' ? 'كشف جديد' : 'متابعة'}</strong> 
          — الخدمة: <strong>${apt.service_name}</strong>
        `;
        
        // Add default prescription row on load
        addPrescriptionRow();
      } else {
        showToast('⚠️ لم يتم العثور على الموعد المحدد.', 'error');
        setTimeout(() => { location.href = 'dashboard.html'; }, 1500);
      }
    }
  } catch (e) {
    showToast('فشل جلب بيانات المريض في غرفة الكشف', 'error');
  }
}

function addPrescriptionRow() {
  const tbody = document.getElementById('prescription-body');
  if (!tbody) return;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" placeholder="مثل: Amoxicillin 500mg" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e2e8f0;padding:8px;font-family:Cairo;font-size:12px;"></td>
    <td><input type="text" placeholder="كبسولة كل 8 ساعات" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e2e8f0;padding:8px;font-family:Cairo;font-size:12px;"></td>
    <td><input type="text" placeholder="5 أيام" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e2e8f0;padding:8px;font-family:Cairo;font-size:12px;"></td>
    <td><input type="text" placeholder="بعد الأكل" style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e2e8f0;padding:8px;font-family:Cairo;font-size:12px;"></td>
    <td><button type="button" class="btn-action btn-danger" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></button></td>
  `;
  tbody.appendChild(row);
}

async function saveConsultation() {
  if (!currentExamAppointment) return;

  const prescriptionItems = [];
  document.querySelectorAll('#prescription-body tr').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0] && inputs[0].value) {
      prescriptionItems.push({
        medication_name: inputs[0].value,
        dosage: inputs[1]?.value || '',
        duration: inputs[2]?.value || '',
        instructions: inputs[3]?.value || ''
      });
    }
  });

  const consultationData = {
    subjective: document.getElementById('soap-subjective').value,
    objective: {
      blood_pressure: document.getElementById('soap-bp').value,
      pulse: parseInt(document.getElementById('soap-pulse').value) || null,
      temperature: parseFloat(document.getElementById('soap-temp').value) || null,
      weight: parseFloat(document.getElementById('soap-weight').value) || null
    },
    diagnosis_icd11: document.getElementById('soap-diagnosis').value,
    plan: document.getElementById('soap-plan').value,
    prescription_items: prescriptionItems
  };

  try {
    // Save SOAP record
    const res = await fetch(`${API_BASE}/v1/appointments/${currentExamAppointment}/consultation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultationData)
    }).then(r => r.json());

    if (res.success) {
      lastPrescriptionData = {
        ...consultationData,
        pdf_url: res.data.pdf_url,
        patient_name: document.getElementById('exam-patient-info')?.textContent || '',
        date: new Date().toLocaleDateString('ar-EG')
      };

      showToast('تم حفظ الزيارة والروشتة بنجاح', 'success');
      setTimeout(() => showToast('تم إرسال الروشتة الإلكترونية للمريض على الواتساب', 'info'), 1000);
      
      // Update appointment status to completed
      await fetch(`${API_BASE}/v1/appointments/${currentExamAppointment}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      
      setTimeout(() => {
        location.href = 'dashboard.html';
      }, 2500);
    } else {
      showToast('فشل حفظ الزيارة: ' + (res.error?.message || 'خطأ غير معروف'), 'error');
    }
  } catch (e) {
    showToast('فشل الاتصال بالسيرفر لحفظ الزيارة', 'error');
  }
}

function printPrescription() {
  let data = lastPrescriptionData;
  if (!data && currentExamAppointment) {
    const items = [];
    document.querySelectorAll('#prescription-body tr').forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs[0]?.value) items.push({
        medication_name: inputs[0].value,
        dosage: inputs[1]?.value || '',
        duration: inputs[2]?.value || '',
        instructions: inputs[3]?.value || ''
      });
    });
    data = {
      diagnosis_icd11: document.getElementById('soap-diagnosis')?.value || '',
      plan: document.getElementById('soap-plan')?.value || '',
      prescription_items: items,
      patient_name: document.getElementById('exam-patient-info')?.textContent || '',
      date: new Date().toLocaleDateString('ar-EG')
    };
  }

  if (!data) {
    showToast('لا توجد روشتة محفوظة للطباعة حالياً', 'error');
    return;
  }

  // Load template preferences from localStorage
  const headerAr = localStorage.getItem('rx_setting_header_ar') || 'عيادة النور لطب الأسنان';
  const headerEn = localStorage.getItem('rx_setting_header_en') || 'Al-Noor Dental Clinic';
  const theme = localStorage.getItem('rx_setting_theme') || 'emerald';
  const footer = localStorage.getItem('rx_setting_footer') || 'القاهرة | هاتف: 01012345678';
  const logoBase64 = localStorage.getItem('rx_setting_logo') || '';

  const themeColors = {
    emerald: { primary: '#059669', secondary: '#d1fae5', text: '#065f46', accent: '#34d399' },
    sky:     { primary: '#0284c7', secondary: '#e0f2fe', text: '#0c4a6e', accent: '#38bdf8' },
    orange:  { primary: '#ea580c', secondary: '#ffedd5', text: '#7c2d12', accent: '#fb923c' },
    dark:    { primary: '#334155', secondary: '#f1f5f9', text: '#1e293b', accent: '#64748b' }
  };
  const c = themeColors[theme] || themeColors.emerald;

  const rxRows = (data.prescription_items || []).map((item, i) => `
    <tr style="background: ${i % 2 === 0 ? '#fff' : c.secondary}">
      <td style="padding:10px 14px; font-weight:700; color:${c.text};">${item.medication_name}</td>
      <td style="padding:10px 14px; color:#374151;">${item.dosage}</td>
      <td style="padding:10px 14px; color:#374151;">${item.duration}</td>
      <td style="padding:10px 14px; color:#6b7280; font-size:12px;">${item.instructions || '—'}</td>
    </tr>`).join('');

  const printHTML = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>روشتة طبية — ${headerAr}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Outfit:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Cairo, sans-serif; background: #f8fafc; color: #1e293b; }
    @media print { body { background: white; } .no-print { display:none !important; } }
    .rx-page { max-width: 800px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
    .rx-header { background: ${c.primary}; padding: 28px 32px; display: flex; align-items: center; justify-content: space-between; }
    .rx-header-logo { ${logoBase64 ? `background-image: url('${logoBase64}'); background-size: contain; background-repeat: no-repeat; width: 80px; height: 60px;` : `width:60px; height:60px; background: rgba(255,255,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; color:white;`} }
    .rx-clinic-name { color: white; }
    .rx-clinic-name h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
    .rx-clinic-name p { font-size: 13px; opacity: 0.85; font-family: Outfit; }
    .rx-meta { background: ${c.secondary}; padding: 16px 32px; display: flex; justify-content: space-between; border-bottom: 2px solid ${c.accent}; }
    .rx-meta-item label { font-size: 11px; color: ${c.text}; opacity: 0.7; display:block; margin-bottom:3px; }
    .rx-meta-item span { font-size: 14px; font-weight: 700; color: ${c.text}; }
    .rx-body { padding: 24px 32px; }
    .rx-section-title { font-size: 13px; font-weight: 700; color: ${c.primary}; text-transform: uppercase; letter-spacing: 1px; margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid ${c.secondary}; }
    .rx-diagnosis { background: ${c.secondary}; border-right: 4px solid ${c.primary}; padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; }
    .rx-diagnosis strong { display:block; font-size:13px; color:${c.text}; margin-bottom:4px; }
    .rx-diagnosis p { color: #374151; font-size:14px; }
    .rx-table { width:100%; border-collapse: collapse; border-radius:8px; overflow:hidden; }
    .rx-table thead tr { background: ${c.primary}; }
    .rx-table thead th { padding: 10px 14px; color:white; font-size:13px; font-weight:700; text-align:right; }
    .rx-table tbody tr:last-child td { border-bottom: none; }
    .rx-plan { background: #f0fdf4; border: 1px dashed #86efac; padding:12px 16px; border-radius:6px; margin-top:18px; color:#166534; font-size:13px; line-height:1.6; }
    .rx-footer { background: ${c.primary}; color: white; text-align:center; padding: 14px 32px; font-size: 12px; opacity: 0.9; margin-top:24px; }
    .rx-stamp { display:flex; justify-content:flex-end; padding: 20px 32px 0; }
    .rx-stamp-box { border: 2px dashed ${c.accent}; padding:12px 24px; border-radius:8px; text-align:center; min-width:160px; color:${c.text}; font-size:12px; }
    .print-btn { display:block; text-align:center; margin:20px auto; padding:12px 32px; background:${c.primary}; color:white; border:none; border-radius:8px; font-family:Cairo; font-size:14px; font-weight:700; cursor:pointer; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()"><i class="fa-solid fa-print"></i> طباعة الروشتة</button>
  <div class="rx-page">
    <div class="rx-header">
      <div class="rx-clinic-name">
        <h1>${headerAr}</h1>
        <p>${headerEn}</p>
      </div>
      <div class="rx-header-logo">${logoBase64 ? '' : '<i class="fa-solid fa-hospital" style="font-size: 32px; color: ' + c.primary + ';"></i>'}</div>
    </div>
    <div class="rx-meta">
      <div class="rx-meta-item"><label>اسم المريض</label><span>${data.patient_name || '—'}</span></div>
      <div class="rx-meta-item"><label>التاريخ</label><span>${data.date || new Date().toLocaleDateString('ar-EG')}</span></div>
      <div class="rx-meta-item"><label>رقم الروشتة</label><span>#RX-${Math.floor(Math.random()*9000+1000)}</span></div>
    </div>
    <div class="rx-body">
      <div class="rx-section-title"><i class="fa-solid fa-microscope"></i> التشخيص</div>
      <div class="rx-diagnosis">
        <strong>كود ICD-11:</strong>
        <p>${data.diagnosis_icd11 || 'غير محدد'}</p>
      </div>
      ${ (data.prescription_items||[]).length > 0 ? `
      <div class="rx-section-title"><i class="fa-solid fa-pills"></i> الأدوية الموصوفة</div>
      <table class="rx-table">
        <thead><tr><th>اسم الدواء</th><th>الجرعة</th><th>المدة</th><th>تعليمات</th></tr></thead>
        <tbody>${rxRows}</tbody>
      </table>` : '<p style="color:#9ca3af; font-style:italic; margin-top:16px;">لا توجد أدوية موصوفة في هذه الزيارة</p>' }
      ${ data.plan ? `<div class="rx-section-title"><i class="fa-solid fa-clipboard-list"></i> الخطة العلاجية</div><div class="rx-plan">${data.plan}</div>` : '' }
    </div>
    <div class="rx-stamp">
      <div class="rx-stamp-box">توقيع الطبيب<br><br><br>________________</div>
    </div>
    <div class="rx-footer">${footer}</div>
  </div>
  <button class="print-btn no-print" onclick="window.print()"><i class="fa-solid fa-print"></i> طباعة الروشتة</button>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(printHTML);
  win.document.close();
}
