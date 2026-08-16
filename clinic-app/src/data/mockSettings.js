// =============================================
// Smart Clinic OS — Mock Settings Data
// =============================================

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

const mockWorkingHours = [
  { day: "sunday", day_ar: "الأحد", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "monday", day_ar: "الإثنين", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "tuesday", day_ar: "الثلاثاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "wednesday", day_ar: "الأربعاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "thursday", day_ar: "الخميس", is_open: true, shifts: [{ start: "09:00", end: "15:00", location: "فرع مصر الجديدة" }] },
  { day: "friday", day_ar: "الجمعة", is_open: false, shifts: [] },
  { day: "saturday", day_ar: "السبت", is_open: true, shifts: [{ start: "10:00", end: "14:00", location: "فرع الدقي" }] }
];

module.exports = {
  mockTenants,
  clinicNotificationSettings,
  clinicOperationalSettings,
  clinicPrescriptionSettings,
  clinicRefundSettings,
  clinicChannelSettings,
  clinicInsuranceCompanies,
  mockWorkingHours,
  // Setters for mutable state
  setNotificationSettings: (val) => { clinicNotificationSettings = val; },
  setOperationalSettings: (val) => { clinicOperationalSettings = val; },
  setPrescriptionSettings: (val) => { clinicPrescriptionSettings = val; },
  setRefundSettings: (val) => { clinicRefundSettings = val; },
  setChannelSettings: (val) => { clinicChannelSettings = val; },
  getNotificationSettings: () => clinicNotificationSettings,
  getOperationalSettings: () => clinicOperationalSettings,
  getPrescriptionSettings: () => clinicPrescriptionSettings,
  getRefundSettings: () => clinicRefundSettings,
  getChannelSettings: () => clinicChannelSettings,
  getInsuranceCompanies: () => clinicInsuranceCompanies
};
