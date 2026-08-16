// =============================================
// Smart Clinic OS — Mock Appointments Data
// =============================================

// --- Date helpers ---
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRelativeDateStr = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayStr = getTodayStr();
const tomorrowStr = getRelativeDateStr(1);

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

module.exports = {
  mockAppointments,
  mockMedicalRecords,
  getTodayStr,
  getRelativeDateStr
};
