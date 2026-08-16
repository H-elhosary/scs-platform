// =============================================
// Smart Clinic OS — Clinic Routes (All /v1/ endpoints)
// Merged from mock_server.js — clinic-specific routes only
// =============================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db/connection');

// --- Mock Data ---
const mockTenants = [
  {
    id: "tenant-uuid-noor", name: "عيادة النور لطب الأسنان", slug: "dr-mohamed-noor",
    status: "active", subscription_plan: "pro", specialty: "dental",
    allow_multi_doctor: true, allow_insurance: false, allow_refunds: false,
    expires_at: "2027-07-01T20:00:00Z",
    owner_name: "د. محمد نور", owner_email: "clinic_info@noor.com", owner_phone: "+201012345678"
  }
];

let clinicNotificationSettings = {
  patient_email_booking_confirm: true, patient_whatsapp_booking_confirm: true,
  patient_email_prescription: true, patient_email_invoice: true,
  doctor_email_new_booking: true, doctor_whatsapp_new_booking: false,
  doctor_email_daily_report: true, doctor_email_weekly_report: true
};

let clinicOperationalSettings = {
  cancellation_window_hours: 6, payment_timeout_minutes: 15,
  followup_grace_period_days: 14, allow_bot_followups: true, refund_destination: 'wallet',
  allow_priority_checkin: true
};

let clinicPrescriptionSettings = {
  header_ar: 'عيادة النور لطب الأسنان', header_en: 'Al-Nour Dental Clinic',
  theme_color: '#1a73e8', footer_text: 'نتمنى لكم الشفاء العاجل', logo_url: ''
};

let clinicRefundSettings = { refund_destination: 'wallet' };

let clinicChannelSettings = {
  bot_greeting: 'مرحباً بك في نظام الحجز الذكي لعيادة النور!\n\nيرجى اختيار الرقم المناسب للمتابعة:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم',
  whatsapp: {
    enabled: false, phone_number_id: '', business_account_id: '', access_token: '',
    webhook_url: 'https://api.smartclinic.com/webhooks/whatsapp/tenant-uuid-noor',
    verify_token: 'scs_verify_' + Math.random().toString(36).substring(2, 10),
    status: 'disconnected', last_tested_at: null
  },
  telegram: {
    enabled: false, bot_token: '', bot_username: '',
    webhook_url: 'https://api.smartclinic.com/webhooks/telegram/tenant-uuid-noor',
    status: 'disconnected', last_tested_at: null
  }
};

let clinicInsuranceCompanies = [
  { id: 'ins-axa', name_ar: 'أكسا للتأمين (AXA)', name_en: 'AXA Insurance', active: true, coverage: 80 },
  { id: 'ins-bupa', name_ar: 'بوبا العربية (Bupa)', name_en: 'Bupa Arabia', active: true, coverage: 90 },
  { id: 'ins-metlife', name_ar: 'ميتلايف (MetLife)', name_en: 'MetLife', active: false, coverage: 70 }
];

const mockTickets = [
  { id: "TKT-1001", tenant_id: "tenant-uuid-noor", tenant_name: "عيادة د. نور لطب الأسنان", type: "upgrade", type_ar: "ترقية الباقة", title: "طلب ترقية لباقة المؤسسات لتفعيل التأمين الطبي", description: "نريد ترقية اشتراكنا الحالي إلى باقة المؤسسات (Enterprise) لتمكين ميزات التأمين الطبي.", status: "pending", created_at: "2026-07-04T12:00:00Z", response_notes: "" },
  { id: "TKT-1002", tenant_id: "tenant-uuid-noor", tenant_name: "عيادة د. نور لطب الأسنان", type: "maintenance", type_ar: "طلب صيانة", title: "مشكلة في تحميل بعض التقارير المالية", description: "التقرير المالي الأسبوعي لم يظهر مساء الجمعة الماضي.", status: "resolved", created_at: "2026-07-03T09:30:00Z", response_notes: "تم فحص المشكلة وإعادة إرسال التقرير يدوياً." }
];

// --- Patients ---
const mockPatients = [
  { id: "pat-001", tenant_id: "tenant-uuid-noor", phone: "+201098765432", full_name: "أحمد محمد حسن", first_name: "أحمد", last_name: "حسن", age: 32, gender: "male", email: "ahmed@example.com", blood_type: "A+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: ["VIP"], total_visits: 5, last_visit_at: "2026-07-02T10:00:00Z", total_paid: 2500, created_at: "2026-01-15T08:00:00Z" },
  { id: "pat-002", tenant_id: "tenant-uuid-noor", phone: "+201112223344", full_name: "سارة علي إبراهيم", first_name: "سارة", last_name: "إبراهيم", age: 28, gender: "female", email: "sara@example.com", blood_type: "B+", allergies: "بنسلين", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 3, last_visit_at: "2026-06-28T14:00:00Z", total_paid: 1500, created_at: "2026-02-10T09:00:00Z" },
  { id: "pat-003", tenant_id: "tenant-uuid-noor", phone: "+201055566677", full_name: "محمود سعيد عبد الله", first_name: "محمود", last_name: "عبد الله", age: 45, gender: "male", email: null, blood_type: "O+", allergies: "لا يوجد", chronic_conditions: "ضغط دم مرتفع", source: "whatsapp_bot", tags: [], total_visits: 8, last_visit_at: "2026-07-01T09:00:00Z", total_paid: 4000, created_at: "2025-11-20T10:00:00Z" },
  { id: "pat-004", tenant_id: "tenant-uuid-noor", phone: "+201199988877", full_name: "هالة عبد الرحمن محمد", first_name: "هالة", last_name: "محمد", age: 35, gender: "female", email: "hala@example.com", blood_type: "AB+", allergies: "أسبرين", chronic_conditions: "سكري نوع 2", source: "whatsapp_bot", tags: ["متابعة"], total_visits: 12, last_visit_at: "2026-07-03T11:00:00Z", total_paid: 6000, created_at: "2025-06-01T08:00:00Z" },
  { id: "pat-005", tenant_id: "tenant-uuid-noor", phone: "+201033344455", full_name: "كريم أحمد مصطفى", first_name: "كريم", last_name: "مصطفى", age: 22, gender: "male", email: null, blood_type: "A-", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 1, last_visit_at: "2026-06-15T16:00:00Z", total_paid: 500, created_at: "2026-06-15T15:00:00Z" },
  { id: "pat-006", tenant_id: "tenant-uuid-noor", phone: "+201277788899", full_name: "فاطمة حسين علي", first_name: "فاطمة", last_name: "علي", age: 50, gender: "female", email: "fatma@example.com", blood_type: "O-", allergies: "مضادات الالتهاب", chronic_conditions: "روماتيزم", source: "whatsapp_bot", tags: ["VIP"], total_visits: 15, last_visit_at: "2026-07-04T08:30:00Z", total_paid: 7500, created_at: "2025-03-10T07:00:00Z" },
  { id: "pat-007", tenant_id: "tenant-uuid-noor", phone: "+201066677788", full_name: "عمر خالد يوسف", first_name: "عمر", last_name: "يوسف", age: 18, gender: "male", email: null, blood_type: "B-", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: [], total_visits: 2, last_visit_at: "2026-06-20T13:00:00Z", total_paid: 1000, created_at: "2026-05-01T11:00:00Z" },
  { id: "pat-008", tenant_id: "tenant-uuid-noor", phone: "+201144455566", full_name: "نورهان محمد سيد", first_name: "نورهان", last_name: "سيد", age: 30, gender: "female", email: "nourhan@example.com", blood_type: "A+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 4, last_visit_at: "2026-06-25T10:00:00Z", total_paid: 2000, created_at: "2026-01-01T09:00:00Z" },
  { id: "pat-009", tenant_id: "tenant-uuid-noor", phone: "+201088899900", full_name: "يوسف إبراهيم أحمد", first_name: "يوسف", last_name: "أحمد", age: 40, gender: "male", email: null, blood_type: "AB-", allergies: "لا يوجد", chronic_conditions: "حساسية موسمية", source: "whatsapp_bot", tags: [], total_visits: 6, last_visit_at: "2026-07-02T15:00:00Z", total_paid: 3000, created_at: "2025-09-15T08:00:00Z" },
  { id: "pat-010", tenant_id: "tenant-uuid-noor", phone: "+201255566677", full_name: "مريم عادل حسن", first_name: "مريم", last_name: "حسن", age: 26, gender: "female", email: "mariam@example.com", blood_type: "O+", allergies: "لاتكس", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: ["VIP"], total_visits: 7, last_visit_at: "2026-07-03T09:00:00Z", total_paid: 3500, created_at: "2025-08-01T10:00:00Z" }
];

// --- Services ---
const mockServices = [
  { id: "svc-001", tenant_id: "tenant-uuid-noor", name: "كشف عام", name_en: "General Exam", price: 500, duration_minutes: 20, category: "exam", is_active: true },
  { id: "svc-002", tenant_id: "tenant-uuid-noor", name: "متابعة مجانية", name_en: "Free Follow-up", price: 0, duration_minutes: 15, category: "followup", is_active: true },
  { id: "svc-003", tenant_id: "tenant-uuid-noor", name: "تنظيف أسنان", name_en: "Teeth Cleaning", price: 800, duration_minutes: 30, category: "procedure", is_active: true },
  { id: "svc-004", tenant_id: "tenant-uuid-noor", name: "حشو عصب", name_en: "Root Canal", price: 2500, duration_minutes: 60, category: "procedure", is_active: true },
  { id: "svc-005", tenant_id: "tenant-uuid-noor", name: "خلع ضرس", name_en: "Tooth Extraction", price: 600, duration_minutes: 30, category: "procedure", is_active: true },
  { id: "svc-006", tenant_id: "tenant-uuid-noor", name: "تبييض أسنان", name_en: "Teeth Whitening", price: 3000, duration_minutes: 45, category: "cosmetic", is_active: true },
  { id: "svc-007", tenant_id: "tenant-uuid-noor", name: "تركيب تقويم", name_en: "Braces Installation", price: 15000, duration_minutes: 90, category: "procedure", is_active: true },
  { id: "svc-008", tenant_id: "tenant-uuid-noor", name: "حشو تجميلي", name_en: "Cosmetic Filling", price: 1200, duration_minutes: 30, category: "procedure", is_active: true }
];

// --- Working Hours ---
const mockWorkingHours = [
  { day: "sunday", day_ar: "الأحد", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "monday", day_ar: "الإثنين", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "tuesday", day_ar: "الثلاثاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "wednesday", day_ar: "الأربعاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "thursday", day_ar: "الخميس", is_open: true, shifts: [{ start: "09:00", end: "15:00", location: "فرع مصر الجديدة" }] },
  { day: "friday", day_ar: "الجمعة", is_open: false, shifts: [] },
  { day: "saturday", day_ar: "السبت", is_open: true, shifts: [{ start: "10:00", end: "14:00", location: "فرع الدقي" }] }
];

// --- Date helpers ---
const getTodayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const getRelativeDateStr = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const todayStr = getTodayStr();
const yesterdayStr = getRelativeDateStr(-1);
const tomorrowStr = getRelativeDateStr(1);
const futureStr = getRelativeDateStr(3);

// --- Appointments ---
const mockAppointments = [
  { id: "apt-001", tenant_id: "tenant-uuid-noor", patient_id: "pat-006", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "09:00", end_time: "09:20", status: "completed", visit_type: "exam", payment_method: "cash", payment_status: "paid", amount: 500, queue_number: 1, notes: "", booking_code: "BK-7001", created_at: "2026-07-03T20:00:00Z" },
  { id: "apt-002", tenant_id: "tenant-uuid-noor", patient_id: "pat-001", doctor_id: "doc-uuid-noor-1", service_id: "svc-004", date: todayStr, time: "11:00", end_time: "12:00", status: "confirmed", visit_type: "exam", payment_method: "online", payment_status: "paid", amount: 2250, queue_number: 5, notes: "حشو عصب ضرس سفلي", booking_code: "BK-7005", created_at: "2026-07-01T09:00:00Z" },
  { id: "apt-003", tenant_id: "tenant-uuid-noor", patient_id: "pat-010", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "11:30", end_time: "11:50", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 6, notes: "", booking_code: "BK-7006", created_at: "2026-07-02T16:00:00Z" },
  { id: "apt-004", tenant_id: "tenant-uuid-noor", patient_id: "pat-002", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "12:00", end_time: "12:20", status: "confirmed", visit_type: "exam", payment_method: "insurance", payment_status: "pending_approval", amount: 500, queue_number: 7, notes: "تأمين طبي — AXA", booking_code: "BK-7007", created_at: "2026-07-03T11:00:00Z" },
  { id: "apt-005", tenant_id: "tenant-uuid-noor", patient_id: "pat-009", doctor_id: "doc-uuid-noor-1", service_id: "svc-005", date: todayStr, time: "17:00", end_time: "17:30", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 600, queue_number: 8, notes: "", booking_code: "BK-7008", created_at: "2026-07-03T22:00:00Z" },
  { id: "apt-006", tenant_id: "tenant-uuid-noor", patient_id: "pat-003", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: tomorrowStr, time: "09:00", end_time: "09:20", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 1, notes: "", booking_code: "BK-7101", created_at: "2026-07-04T10:00:00Z" }
];

const mockMedicalRecords = [
  { id: "rec-001", tenant_id: "tenant-uuid-noor", patient_id: "pat-006", appointment_id: "apt-001", doctor_id: "doc-uuid-noor-1", subjective: "ألم في الضرس العلوي الأيسر", objective: { blood_pressure: "120/80", pulse: 72, temperature: 37.0, weight: 68 }, diagnosis_icd11: "DA01.1 - Dental caries extending into dentine", plan: "حشو تجميلي للضرس 26 + مسكن ألم", prescription_items: [{ medication_name: "Ibuprofen 400mg", dosage: "قرص كل 8 ساعات بعد الأكل", duration: "3 أيام" }], created_at: "2026-07-04T09:20:00Z" }
];

const mockConversations = [
  { id: "conv-001", tenant_id: "tenant-uuid-noor", patient_id: "pat-001", patient_name: "أحمد محمد", channel: "whatsapp", bot_active: true, last_message: "تمام عايز أحجز مع الدكتور", last_message_at: "2026-07-04T12:30:00Z", unread_count: 2, status: "active", messages: [
    { id: "msg-001", sender: "patient", text: "السلام عليكم", timestamp: "2026-07-04T12:25:00Z" },
    { id: "msg-002", sender: "bot", text: "مرحباً أستاذ أحمد! كيف يمكننا مساعدتك اليوم؟", timestamp: "2026-07-04T12:25:05Z" },
    { id: "msg-003", sender: "patient", text: "تمام عايز أحجز مع الدكتور", timestamp: "2026-07-04T12:30:00Z" }
  ]},
  { id: "conv-002", tenant_id: "tenant-uuid-noor", patient_id: "pat-002", patient_name: "سارة علي", channel: "whatsapp", bot_active: false, last_message: "المواعيد دي مش مناسبة لي", last_message_at: "2026-07-04T12:15:00Z", unread_count: 1, status: "manual_mode", messages: [
    { id: "msg-004", sender: "patient", text: "عايزة أحجز كشف أسنان", timestamp: "2026-07-04T12:00:00Z" },
    { id: "msg-005", sender: "bot", text: "يرجى اختيار الميعاد المناسب", timestamp: "2026-07-04T12:00:10Z" },
    { id: "msg-006", sender: "patient", text: "المواعيد دي مش مناسبة لي", timestamp: "2026-07-04T12:15:00Z" }
  ]}
];

let currentQueueState = {
  current_in_exam: null,
  waiting_list: [],
  last_called_at: ""
};

// =============================================
// CLINIC API ROUTES
// =============================================

// --- Dashboard Stats ---
router.get('/v1/dashboard/stats', (req, res) => {
  const today = getTodayStr();
  const todayAppts = mockAppointments.filter(a => a.date === today);
  const completed = todayAppts.filter(a => a.status === 'completed');
  const checkedIn = todayAppts.filter(a => a.status === 'checked_in');
  const confirmed = todayAppts.filter(a => a.status === 'confirmed');
  const noShows = todayAppts.filter(a => a.status === 'no_show');
  const totalRevenue = todayAppts.filter(a => a.payment_status === 'paid').reduce((sum, a) => sum + a.amount, 0);

  return res.json({
    success: true,
    data: {
      today_date: today,
      patients_today: todayAppts.length,
      completed_count: completed.length,
      checked_in_count: checkedIn.length,
      confirmed_count: confirmed.length,
      no_show_count: noShows.length,
      attendance_rate: todayAppts.length > 0 ? Math.round(((completed.length + checkedIn.length) / ((completed.length + checkedIn.length + noShows.length) || 1)) * 100) : 0,
      total_revenue: totalRevenue,
      online_revenue: todayAppts.filter(a => a.payment_status === 'paid' && a.payment_method === 'online').reduce((sum, a) => sum + a.amount, 0),
      cash_revenue: todayAppts.filter(a => a.payment_status === 'paid' && a.payment_method === 'cash').reduce((sum, a) => sum + a.amount, 0),
      new_patients_today: 1,
      total_patients: mockPatients.length,
      pending_approvals: todayAppts.filter(a => a.payment_status === 'pending_approval').length,
      active_conversations: mockConversations.filter(c => c.status === 'active' || c.status === 'manual_mode').length,
      tenant_name: "عيادة النور لطب الأسنان",
      allow_multi_doctor: mockTenants[0]?.allow_multi_doctor || false,
      allow_insurance: mockTenants[0]?.allow_insurance || false,
      allow_refunds: mockTenants[0]?.allow_refunds || false
    }
  });
});

// --- Patients ---
router.get('/v1/patients', (req, res) => {
  const { search, tag, page = 1, limit = 20 } = req.query;
  let filtered = [...mockPatients];
  if (search) { const s = search.toLowerCase(); filtered = filtered.filter(p => p.full_name.toLowerCase().includes(s) || p.phone.includes(s) || (p.email && p.email.toLowerCase().includes(s))); }
  if (tag) { filtered = filtered.filter(p => p.tags.includes(tag)); }
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = filtered.slice(start, start + parseInt(limit));
  return res.json({ success: true, data: { patients: paginated, total: filtered.length, page: parseInt(page), total_pages: Math.ceil(filtered.length / parseInt(limit)) } });
});

router.get('/v1/patients/:id', (req, res) => {
  const patient = mockPatients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: { code: "PATIENT_NOT_FOUND", message: "المريض غير موجود" } });
  const appointments = mockAppointments.filter(a => a.patient_id === patient.id).map(a => { const svc = mockServices.find(s => s.id === a.service_id); return { ...a, service_name: svc ? svc.name : 'غير محدد' }; });
  const records = mockMedicalRecords.filter(r => r.patient_id === patient.id);
  return res.json({ success: true, data: { patient, appointments, medical_records: records } });
});

router.post('/v1/patients', (req, res) => {
  const { full_name, phone, age, gender, email } = req.body;
  const names = full_name.split(' ');
  const newPatient = { id: `pat-${Math.random().toString(36).substring(7)}`, tenant_id: "tenant-uuid-noor", phone, full_name, first_name: names[0] || full_name, last_name: names.length > 1 ? names[names.length - 1] : '', age: parseInt(age) || null, gender: gender || null, email: email || null, blood_type: null, allergies: null, chronic_conditions: null, source: "manual", tags: [], total_visits: 0, last_visit_at: null, total_paid: 0, created_at: new Date().toISOString() };
  mockPatients.push(newPatient);
  return res.status(201).json({ success: true, data: newPatient });
});

router.put('/v1/patients/:id', (req, res) => {
  const patient = mockPatients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: { code: "PATIENT_NOT_FOUND", message: "المريض غير موجود" } });
  Object.assign(patient, req.body);
  return res.json({ success: true, data: patient });
});

// --- Appointments ---
router.get('/v1/appointments', (req, res) => {
  const { date, date_from, date_to, status, doctor_id } = req.query;
  let filtered = [...mockAppointments];
  if (date) filtered = filtered.filter(a => a.date === date);
  if (date_from) filtered = filtered.filter(a => a.date >= date_from);
  if (date_to) filtered = filtered.filter(a => a.date <= date_to);
  if (status) filtered = filtered.filter(a => a.status === status);
  if (doctor_id) filtered = filtered.filter(a => a.doctor_id === doctor_id);
  const enriched = filtered.map(a => { const patient = mockPatients.find(p => p.id === a.patient_id); const service = mockServices.find(s => s.id === a.service_id); return { ...a, patient_name: patient ? patient.full_name : 'غير معروف', patient_phone: patient ? patient.phone : '', patient_gender: patient ? patient.gender : '', patient_age: patient ? patient.age : null, service_name: service ? service.name : 'غير محدد', service_duration: service ? service.duration_minutes : 20 }; });
  return res.json({ success: true, data: enriched });
});

router.get('/v1/appointments/:id', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
  const patient = mockPatients.find(p => p.id === apt.patient_id);
  const service = mockServices.find(s => s.id === apt.service_id);
  return res.json({ success: true, data: { ...apt, patient, service } });
});

router.post('/v1/appointments', (req, res) => {
  const { patient_id, doctor_id, service_id, date, time, visit_type, payment_method, notes, location } = req.body;
  const targetDoctorId = doctor_id || "doc-uuid-noor-1";
  const service = mockServices.find(s => s.id === service_id);
  const durationMin = service ? service.duration_minutes : 20;
  const [h, m] = time.split(':').map(Number);
  const endDate = new Date(2026, 0, 1, h, m + durationMin);
  const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

  const todayAppts = mockAppointments.filter(a => a.date === date && a.doctor_id === targetDoctorId && a.status !== 'cancelled');
  
  // Conflict check: Overlap of intervals [start, end]
  const getMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const newStart = getMinutes(time);
  const newEnd = newStart + durationMin;

  const hasConflict = todayAppts.some(a => {
    const start = getMinutes(a.time);
    const end = getMinutes(a.end_time || a.time); // Fallback to start if end_time is not set
    return newStart < end && start < newEnd;
  });

  if (hasConflict) {
    return res.status(400).json({
      success: false,
      error: {
        code: "APPOINTMENT_CONFLICT",
        message: "هذا الوقت يتعارض مع موعد محجوز بالفعل لهذا الطبيب"
      }
    });
  }

  const maxQueue = todayAppts.reduce((max, a) => (a.queue_number && a.queue_number > max) ? a.queue_number : max, 0);

  const newApt = {
    id: `apt-${Math.random().toString(36).substring(7)}`, tenant_id: "tenant-uuid-noor",
    patient_id, doctor_id: targetDoctorId, service_id: service_id || "svc-001", date, time, end_time: endTime,
    status: "confirmed", visit_type: visit_type || "exam", payment_method: payment_method || "cash",
    payment_status: payment_method === 'online' ? 'paid' : (visit_type === 'followup' ? 'free' : 'pending'),
    amount: service ? (payment_method === 'online' ? Math.round(service.price * 0.9) : service.price) : 500,
    queue_number: maxQueue + 1, notes: notes || '', location: location || '',
    booking_code: `BK-${Math.floor(Math.random() * 9000 + 1000)}`, created_at: new Date().toISOString()
  };
  mockAppointments.push(newApt);
  return res.status(201).json({ success: true, data: newApt });
});

router.put('/v1/appointments/:id', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  
  Object.assign(apt, req.body);
  
  if (req.body.time) {
    const service = mockServices.find(s => s.id === apt.service_id);
    const durationMin = service ? service.duration_minutes : 20;
    const [h, m] = apt.time.split(':').map(Number);
    const endDate = new Date(2026, 0, 1, h, m + durationMin);
    apt.end_time = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
  }
  
  return res.json({ success: true, data: apt });
});

router.put('/v1/appointments/:id/status', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  apt.status = req.body.status;
  if (req.body.status === 'completed' && apt.payment_method === 'cash') apt.payment_status = 'paid';
  
  if (req.body.status === 'completed' || req.body.status === 'cancelled') {
    if (currentQueueState.current_in_exam && currentQueueState.current_in_exam.appointment_id === req.params.id) {
      currentQueueState.current_in_exam = null;
    }
    currentQueueState.waiting_list = currentQueueState.waiting_list.filter(item => item.appointment_id !== req.params.id);
  }
  
  if (req.body.status === 'checked_in') {
    const alreadyInQueue = currentQueueState.waiting_list.some(item => item.appointment_id === apt.id);
    if (!alreadyInQueue) {
      const patient = mockPatients.find(p => p.id === apt.patient_id);
      const isUrgent = !!req.body.is_urgent;
      const waitingItem = {
        queue_number: apt.queue_number,
        patient_name: patient ? patient.full_name : 'مريض جديد',
        appointment_id: apt.id,
        is_urgent: isUrgent
      };
      
      if (isUrgent) {
        const lastUrgentIdx = currentQueueState.waiting_list.map(i => i.is_urgent).lastIndexOf(true);
        currentQueueState.waiting_list.splice(lastUrgentIdx + 1, 0, waitingItem);
      } else {
        currentQueueState.waiting_list.push(waitingItem);
      }
    }
  }
  return res.json({ success: true, data: apt });
});

router.delete('/v1/appointments/:id', (req, res) => {
  const idx = mockAppointments.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  mockAppointments[idx].status = 'cancelled';
  
  if (currentQueueState.current_in_exam && currentQueueState.current_in_exam.appointment_id === req.params.id) {
    currentQueueState.current_in_exam = null;
  }
  currentQueueState.waiting_list = currentQueueState.waiting_list.filter(item => item.appointment_id !== req.params.id);
  return res.json({ success: true, data: mockAppointments[idx] });
});

// --- Consultation ---
router.post('/v1/appointments/:appointment_id/consultation', (req, res) => {
  const { appointment_id } = req.params;
  const data = req.body;
  const apt = mockAppointments.find(a => a.id === appointment_id);
  if (!apt) return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  apt.status = 'completed';
  
  if (currentQueueState.current_in_exam && currentQueueState.current_in_exam.appointment_id === appointment_id) {
    currentQueueState.current_in_exam = null;
  }
  currentQueueState.waiting_list = currentQueueState.waiting_list.filter(item => item.appointment_id !== appointment_id);

  const recordId = `rec-${Date.now()}`;
  const prescriptionId = `rx-${Date.now()}`;
  const pdfUrl = `https://storage.SCS-admin.com/prescriptions/${prescriptionId}.pdf`;
  mockMedicalRecords.push({ id: recordId, tenant_id: apt.tenant_id, patient_id: apt.patient_id, appointment_id, doctor_id: apt.doctor_id || "doc-uuid-noor-1", subjective: data.subjective || "كشف سريري", objective: data.objective || {}, diagnosis_icd11: data.diagnosis_icd11 || "عام", plan: data.plan || "", prescription_items: data.prescription_items || [], created_at: new Date().toISOString() });
  return res.status(200).json({ success: true, data: { medical_record_id: recordId, prescription_id: prescriptionId, pdf_url: pdfUrl, whatsapp_status: "enqueued" } });
});

// --- Queue ---
router.get('/v1/queue/today', (req, res) => { return res.json({ success: true, data: currentQueueState }); });
router.post('/v1/queue/check-in/:appointmentId', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.appointmentId);
  if (!apt) return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  apt.status = 'checked_in';
  return res.json({ success: true, data: apt });
});
router.post('/v1/queue/start-exam/:appointmentId', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.appointmentId);
  if (!apt) return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  
  const patient = mockPatients.find(p => p.id === apt.patient_id);
  currentQueueState.current_in_exam = {
    queue_number: apt.queue_number,
    patient_name: patient ? patient.full_name : 'مريض',
    appointment_id: apt.id,
    doctor_name: "د. محمد نور"
  };
  currentQueueState.last_called_at = new Date().toISOString();
  
  currentQueueState.waiting_list = currentQueueState.waiting_list.filter(item => item.appointment_id !== apt.id);
  return res.json({ success: true, data: currentQueueState });
});
router.post('/v1/queue/call-next', (req, res) => { return res.status(200).json({ success: true, data: { called_patient: { queue_number: 14, display_name: "محمد أ." }, websocket_broadcast_sent: true } }); });
router.post('/v1/queue/call-next-patient', (req, res) => {
  if (currentQueueState.waiting_list.length === 0) return res.json({ success: true, data: { message: "لا يوجد مرضى في قائمة الانتظار", called_patient: null } });
  const next = currentQueueState.waiting_list.shift();
  currentQueueState.current_in_exam = { ...next, doctor_name: "د. محمد نور" };
  currentQueueState.last_called_at = new Date().toISOString();
  return res.json({ success: true, data: { called_patient: next, current_in_exam: currentQueueState.current_in_exam, remaining: currentQueueState.waiting_list.length, websocket_broadcast_sent: true } });
});
router.post('/v1/sync', (req, res) => { return res.status(200).json({ success: true, data: { synced_count: (req.body.actions || []).length, conflicts: [] } }); });

// --- Services ---
router.get('/v1/settings/services', (req, res) => { return res.json({ success: true, data: mockServices }); });
router.post('/v1/settings/services', (req, res) => {
  const { name, name_en, price, duration_minutes, category } = req.body;
  const newService = { id: `svc-${Math.random().toString(36).substring(7)}`, tenant_id: "tenant-uuid-noor", name, name_en: name_en || '', price: parseFloat(price) || 0, duration_minutes: parseInt(duration_minutes) || 20, category: category || 'exam', is_active: true };
  mockServices.push(newService);
  return res.status(201).json({ success: true, data: newService });
});
router.put('/v1/settings/services/:id', (req, res) => {
  const svc = mockServices.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ success: false, error: { message: "الخدمة غير موجودة" } });
  Object.assign(svc, req.body);
  return res.json({ success: true, data: svc });
});

// --- Working Hours ---
router.get('/v1/settings/working-hours', (req, res) => {
  const { doctor_id } = req.query;
  if (doctor_id) {
    if (!db.memoryDB.doctorWorkingHours) db.memoryDB.doctorWorkingHours = {};
    if (!db.memoryDB.doctorWorkingHours[doctor_id]) {
      let customHours = JSON.parse(JSON.stringify(mockWorkingHours));
      if (doctor_id !== "doc-uuid-noor-1" && doctor_id !== "doc-1") {
        customHours.forEach(h => { if (h.day === 'tuesday' || h.day === 'thursday') { h.is_open = false; h.shifts = []; } });
      }
      db.memoryDB.doctorWorkingHours[doctor_id] = customHours;
    }
    return res.json({ success: true, data: db.memoryDB.doctorWorkingHours[doctor_id] });
  }
  return res.json({ success: true, data: mockWorkingHours });
});
router.put('/v1/settings/working-hours', (req, res) => {
  const { doctor_id } = req.query;
  const { working_hours } = req.body;
  if (doctor_id) {
    if (!db.memoryDB.doctorWorkingHours) db.memoryDB.doctorWorkingHours = {};
    if (working_hours && Array.isArray(working_hours)) db.memoryDB.doctorWorkingHours[doctor_id] = working_hours;
    return res.json({ success: true, data: db.memoryDB.doctorWorkingHours[doctor_id] });
  }
  if (working_hours && Array.isArray(working_hours)) { working_hours.forEach(wh => { const existing = mockWorkingHours.find(h => h.day === wh.day); if (existing) Object.assign(existing, wh); }); }
  return res.json({ success: true, data: mockWorkingHours });
});

// --- Settings ---
router.get('/v1/settings/notifications', (req, res) => { return res.json({ success: true, data: { notification_settings: clinicNotificationSettings } }); });
router.put('/v1/settings/notifications', (req, res) => { if (req.body.notification_settings) clinicNotificationSettings = { ...clinicNotificationSettings, ...req.body.notification_settings }; return res.json({ success: true, data: { message: "تم تحديث إعدادات الإشعارات بنجاح", updated_settings: clinicNotificationSettings } }); });
router.get('/v1/settings/operational', (req, res) => { return res.json({ success: true, data: clinicOperationalSettings }); });
router.put('/v1/settings/operational', (req, res) => { clinicOperationalSettings = { ...clinicOperationalSettings, ...req.body }; return res.json({ success: true, data: clinicOperationalSettings }); });
router.get('/v1/settings/prescription', (req, res) => { return res.json({ success: true, data: clinicPrescriptionSettings }); });
router.put('/v1/settings/prescription', (req, res) => { clinicPrescriptionSettings = { ...clinicPrescriptionSettings, ...req.body }; return res.json({ success: true, data: clinicPrescriptionSettings }); });
router.get('/v1/settings/refund', (req, res) => { return res.json({ success: true, data: clinicRefundSettings }); });
router.put('/v1/settings/refund', (req, res) => { clinicRefundSettings = { ...clinicRefundSettings, ...req.body }; return res.json({ success: true, data: clinicRefundSettings }); });

// --- Insurance ---
router.get('/v1/settings/insurance', (req, res) => { return res.json({ success: true, data: clinicInsuranceCompanies }); });
router.post('/v1/settings/insurance', (req, res) => { const { name_ar, name_en, coverage } = req.body; if (!name_ar || !name_en) return res.status(400).json({ success: false, error: { message: "الاسم مطلوب" } }); const nc = { id: `ins-${Math.random().toString(36).substring(7)}`, name_ar, name_en, active: true, coverage: parseInt(coverage) || 80 }; clinicInsuranceCompanies.push(nc); return res.json({ success: true, data: nc }); });
router.put('/v1/settings/insurance/:id', (req, res) => { const c = clinicInsuranceCompanies.find(c => c.id === req.params.id); if (!c) return res.status(404).json({ success: false, error: { message: "شركة التأمين غير موجودة" } }); if (req.body.active !== undefined) c.active = req.body.active; if (req.body.coverage !== undefined) c.coverage = parseInt(req.body.coverage); return res.json({ success: true, data: c }); });

// --- Channels ---
let telegramPollInterval = null;
let lastUpdateId = 0;

function startTelegramPolling(botToken) {
  if (telegramPollInterval) {
    clearInterval(telegramPollInterval);
  }
  console.log(`📡 [Telegram Polling] Starting background updates poll loop...`);
  
  // Try to delete webhook to ensure Telegram sends updates via getUpdates
  fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`)
    .then(r => r.json())
    .catch(e => {});

  telegramPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`)
        .then(r => r.json());
        
      if (res.ok && res.result && res.result.length > 0) {
        const botController = require('../services/botController');
        for (const update of res.result) {
          lastUpdateId = update.update_id;
          const message = update.message;
          if (message) {
            const chatId = message.chat.id.toString();
            const text = message.text || '';
            const firstName = message.from ? message.from.first_name : 'مريض';
            const tenantId = "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

            console.log(`\n💬 [Telegram Polling Received] From Chat ID: ${chatId} (${firstName}): "${text}"`);
            
            const botResponse = await botController.handleIncomingMessage(tenantId, 'telegram', chatId, text, firstName);
            console.log(`📱 [Telegram Polling Outgoing Reply] To Chat ID: ${chatId} -> "${botResponse.reply}"`);
            
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: botResponse.reply
              })
            }).then(r => r.json());
          }
        }
      }
    } catch (err) {
      // Quietly ignore network failures
    }
  }, 2000);
}

function stopTelegramPolling() {
  if (telegramPollInterval) {
    clearInterval(telegramPollInterval);
    telegramPollInterval = null;
    console.log(`📡 [Telegram Polling] Stopped background updates poll loop.`);
  }
}

router.get('/v1/settings/channels', (req, res) => { return res.json({ success: true, data: clinicChannelSettings }); });
router.put('/v1/settings/channels/whatsapp', (req, res) => { clinicChannelSettings.whatsapp = { ...clinicChannelSettings.whatsapp, ...req.body, webhook_url: clinicChannelSettings.whatsapp.webhook_url, verify_token: clinicChannelSettings.whatsapp.verify_token }; return res.json({ success: true, data: clinicChannelSettings.whatsapp }); });

router.put('/v1/settings/channels/telegram', (req, res) => {
  clinicChannelSettings.telegram = { ...clinicChannelSettings.telegram, ...req.body, webhook_url: clinicChannelSettings.telegram.webhook_url };
  if (clinicChannelSettings.telegram.enabled && clinicChannelSettings.telegram.bot_token) {
    startTelegramPolling(clinicChannelSettings.telegram.bot_token);
  } else {
    stopTelegramPolling();
  }
  return res.json({ success: true, data: clinicChannelSettings.telegram });
});

router.put('/v1/settings/channels/doctor', (req, res) => {
  clinicChannelSettings.bot_greeting = req.body.bot_greeting || clinicChannelSettings.bot_greeting;
  clinicChannelSettings.whatsapp.enabled = !!req.body.whatsapp_enabled;
  clinicChannelSettings.telegram.enabled = !!req.body.telegram_enabled;
  if (clinicChannelSettings.telegram.enabled && clinicChannelSettings.telegram.bot_token) {
    startTelegramPolling(clinicChannelSettings.telegram.bot_token);
  } else {
    stopTelegramPolling();
  }
  return res.json({ success: true, data: { bot_greeting: clinicChannelSettings.bot_greeting, whatsapp_enabled: clinicChannelSettings.whatsapp.enabled, telegram_enabled: clinicChannelSettings.telegram.enabled } });
});

router.post('/v1/settings/channels/whatsapp/test', (req, res) => { if (!clinicChannelSettings.whatsapp.phone_number_id || !clinicChannelSettings.whatsapp.access_token) return res.status(400).json({ success: false, error: { message: 'يرجى إدخال بيانات واتساب أولاً' } }); clinicChannelSettings.whatsapp.status = 'connected'; clinicChannelSettings.whatsapp.enabled = true; clinicChannelSettings.whatsapp.last_tested_at = new Date().toISOString(); return res.json({ success: true, data: { status: 'connected', message: '✅ تم الاتصال بنجاح!' } }); });

router.post('/v1/settings/channels/telegram/test', (req, res) => {
  if (!clinicChannelSettings.telegram.bot_token) return res.status(400).json({ success: false, error: { message: 'يرجى إدخال Bot Token أولاً' } });
  clinicChannelSettings.telegram.status = 'connected';
  clinicChannelSettings.telegram.enabled = true;
  clinicChannelSettings.telegram.last_tested_at = new Date().toISOString();
  startTelegramPolling(clinicChannelSettings.telegram.bot_token);
  return res.json({ success: true, data: { status: 'connected', message: '✅ تم ربط وتفعيل بوت تليجرام بنجاح!' } });
});

// --- Tickets (Clinic-side) ---
router.get('/v1/tickets', (req, res) => { const tenantId = 'tenant-uuid-noor'; const tickets = mockTickets.filter(t => t.tenant_id === tenantId); return res.json({ success: true, data: tickets }); });
router.post('/v1/tickets', (req, res) => {
  const { type, title, description } = req.body;
  if (!type || !title || !description) return res.status(400).json({ success: false, error: { message: "يرجى تعبئة كافة الحقول المطلوبة" } });
  const typeLabels = { renew: "تجديد اشتراك", upgrade: "ترقية الباقة", maintenance: "طلب صيانة", complaint: "شكوى أو اقتراح" };
  const newTicket = { id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`, tenant_id: 'tenant-uuid-noor', tenant_name: 'عيادة النور لطب الأسنان', type, type_ar: typeLabels[type] || type, title, description, status: "pending", created_at: new Date().toISOString(), response_notes: "" };
  mockTickets.push(newTicket);
  return res.status(201).json({ success: true, data: newTicket });
});

// --- Staff ---
router.post('/v1/staff', (req, res) => { return res.status(201).json({ success: true, data: { staff_id: `staff-uuid-${Math.random().toString(36).substring(7)}`, role: "secretary", invitation_sent: true } }); });
router.post('/v1/chats/:conversation_id/toggle-bot', (req, res) => { return res.status(200).json({ success: true, data: { conversation_id: req.params.conversation_id, bot_active: !req.body.manual_mode } }); });

// --- Doctors ---
router.get('/v1/doctors', (req, res) => { const docs = db.memoryDB.doctors.filter(d => d.tenant_id === "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d"); return res.json({ success: true, data: docs }); });
router.post('/v1/doctors', (req, res) => {
  const { full_name, specialty } = req.body;
  if (!full_name || !specialty) return res.status(400).json({ success: false, error: { message: "يرجى إدخال اسم الطبيب وتخصصه" } });
  const tenant = mockTenants[0];
  const doctorsCount = db.memoryDB.doctors.filter(d => d.tenant_id === "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d").length;
  if (!tenant.allow_multi_doctor && doctorsCount >= 1) return res.status(400).json({ success: false, error: { code: "MULTI_DOCTOR_LOCKED", message: "صلاحية الأطباء المتعددين غير مفعلة لباقة اشتراكك الحالية." } });
  const newDoctor = { id: `doc-${Math.random().toString(36).substring(7)}`, tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d", full_name, specialty, created_at: new Date().toISOString() };
  db.memoryDB.doctors.push(newDoctor);
  return res.json({ success: true, data: newDoctor });
});

// --- Medical Records ---
router.get('/v1/patients/:id/medical-records', (req, res) => { return res.json({ success: true, data: mockMedicalRecords.filter(r => r.patient_id === req.params.id) }); });

// --- Inbox ---
router.get('/v1/inbox/conversations', (req, res) => { const mapped = mockConversations.map(c => ({ ...c, messages: c.messages.map(m => ({ ...m, body: m.body || m.text })) })); return res.json({ success: true, data: mapped }); });
router.post('/v1/inbox/conversations/:id/read', (req, res) => { const conv = mockConversations.find(c => c.id === req.params.id); if (!conv) return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } }); conv.unread_count = 0; return res.json({ success: true, data: { ...conv, messages: conv.messages.map(m => ({ ...m, body: m.body || m.text })) } }); });
router.post('/v1/inbox/conversations/:id/messages', (req, res) => { const conv = mockConversations.find(c => c.id === req.params.id); if (!conv) return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } }); const { body } = req.body; const newMsg = { id: `msg-${Math.random().toString(36).substring(7)}`, sender: "secretary", body, text: body, timestamp: new Date().toISOString() }; conv.messages.push(newMsg); conv.last_message = body; conv.last_message_at = newMsg.timestamp; conv.bot_active = false; conv.status = 'manual_mode'; return res.json({ success: true, data: { ...conv, messages: conv.messages.map(m => ({ ...m, body: m.body || m.text })) } }); });
router.post('/v1/inbox/conversations/:id/bot', (req, res) => { const conv = mockConversations.find(c => c.id === req.params.id); if (!conv) return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } }); conv.bot_active = !!req.body.active; conv.status = req.body.active ? 'active' : 'manual_mode'; return res.json({ success: true, data: { bot_active: conv.bot_active, status: conv.status } }); });

module.exports = router;
