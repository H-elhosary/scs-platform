// =============================================
// Smart Clinic OS — Mock Services Data
// =============================================

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

module.exports = mockServices;
