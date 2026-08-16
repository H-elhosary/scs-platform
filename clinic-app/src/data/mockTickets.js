// =============================================
// Smart Clinic OS — Mock Tickets Data
// =============================================

const mockTickets = [
  {
    id: "TKT-1001", tenant_id: "tenant-uuid-noor", tenant_name: "عيادة د. نور لطب الأسنان",
    type: "upgrade", type_ar: "ترقية الباقة",
    title: "طلب ترقية لباقة المؤسسات لتفعيل التأمين الطبي",
    description: "نريد ترقية اشتراكنا الحالي إلى باقة المؤسسات (Enterprise) لتمكين ميزات التأمين الطبي.",
    status: "pending", created_at: "2026-07-04T12:00:00Z", response_notes: ""
  },
  {
    id: "TKT-1002", tenant_id: "tenant-uuid-noor", tenant_name: "عيادة د. نور لطب الأسنان",
    type: "maintenance", type_ar: "طلب صيانة",
    title: "مشكلة في تحميل بعض التقارير المالية",
    description: "التقرير المالي الأسبوعي لم يظهر مساء الجمعة الماضي.",
    status: "resolved", created_at: "2026-07-03T09:30:00Z",
    response_notes: "تم فحص المشكلة وإعادة إرسال التقرير يدوياً."
  }
];

module.exports = mockTickets;
