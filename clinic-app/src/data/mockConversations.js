// =============================================
// Smart Clinic OS — Mock Conversations Data
// =============================================

const now = new Date();
const timeMinus = (mins) => new Date(now.getTime() - mins * 60000).toISOString();

const mockConversations = [
  {
    id: "conv-001",
    tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    patient_id: "pat-001",
    patient_name: "أحمد محمد حسن",
    patient_phone: "+201098765432",
    channel: "whatsapp",
    bot_active: true,
    last_message: "تمام محتاج أحجز موعد كشف غداً الساعة 5 مساءً",
    last_message_at: timeMinus(5),
    unread_count: 2,
    status: "active",
    messages: [
      { id: "msg-001", sender: "patient", text: "السلام عليكم ورحمة الله وبركاته، هل العيادة مفتوحة اليوم؟", timestamp: timeMinus(25) },
      { id: "msg-002", sender: "bot", text: "وعليكم السلام ورحمة الله! أهلاً بك في عيادتنا. نعم، العيادة مفتوحة اليوم حتى الساعة 10:00 مساءً. هل تود حجز موعد كشف أو استشارة؟", timestamp: timeMinus(24) },
      { id: "msg-003", sender: "patient", text: "عندي ألم مفاجئ ومحتاج موعد مع الدكتور", timestamp: timeMinus(10) },
      { id: "msg-004", sender: "bot", text: "سلامتك ألف سلامة. الأوقات المتاحة غداً: 4:00 م، 5:00 م، 6:30 م. أيهم يناسبك؟", timestamp: timeMinus(9) },
      { id: "msg-005", sender: "patient", text: "تمام محتاج أحجز موعد كشف غداً الساعة 5 مساءً", timestamp: timeMinus(5) }
    ]
  },
  {
    id: "conv-002",
    tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    patient_id: "pat-002",
    patient_name: "سارة علي إبراهيم",
    patient_phone: "+201112223344",
    channel: "whatsapp",
    bot_active: false,
    last_message: "شكراً جزيلاً لحضرتك دكتور، هكون في الميعاد المحدد بإذن الله",
    last_message_at: timeMinus(45),
    unread_count: 0,
    status: "manual_mode",
    messages: [
      { id: "msg-006", sender: "patient", text: "مساء الخير، كنت حابة استفسر عن مواعيد إعادة الكشف بعد جلسة الحشو؟", timestamp: timeMinus(90) },
      { id: "msg-007", sender: "secretary", text: "أهلاً بك أستاذة سارة! الإعادة تكون خلال أسبوعين من تاريخ الجلسة، ومجانية تماماً.", timestamp: timeMinus(60) },
      { id: "msg-008", sender: "patient", text: "تمام ممكن يوم الثلاثاء القادم الساعة 6 مساءً؟", timestamp: timeMinus(50) },
      { id: "msg-009", sender: "secretary", text: "تم تسجيل موعد المتابعة ليوم الثلاثاء الساعة 6:00 مساءً بنجاح!", timestamp: timeMinus(48) },
      { id: "msg-010", sender: "patient", text: "شكراً جزيلاً لحضرتك دكتور، هكون في الميعاد المحدد بإذن الله", timestamp: timeMinus(45) }
    ]
  },
  {
    id: "conv-003",
    tenant_id: "b8c4d3e2-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    patient_id: "pat-o01",
    patient_name: "عمرو طارق السيد",
    patient_phone: "+201077788899",
    channel: "whatsapp",
    bot_active: true,
    last_message: "عندي استفسار بخصوص نتيجة أشعة الركبة",
    last_message_at: timeMinus(120),
    unread_count: 1,
    status: "active",
    messages: [
      { id: "msg-011", sender: "patient", text: "مرحباً دكتور خالد، هل وصلت نتيجة الأشعة السينية الخاصة بي؟", timestamp: timeMinus(150) },
      { id: "msg-012", sender: "bot", text: "أهلاً أستاذ عمرو! تم استلام تقرير الأشعة وسيطلع عليه الطبيب المختص لإرفاقه في ملفك الطبي.", timestamp: timeMinus(149) },
      { id: "msg-013", sender: "patient", text: "عندي استفسار بخصوص نتيجة أشعة الركبة", timestamp: timeMinus(120) }
    ]
  },
  {
    id: "conv-004",
    tenant_id: "b8c4d3e2-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    patient_id: "pat-o02",
    patient_name: "فاطمة حسن علي",
    patient_phone: "+201066677788",
    channel: "telegram",
    bot_active: true,
    last_message: "هل يمكن الدفع فودافون كاش أو بطاقة فيزا؟",
    last_message_at: timeMinus(180),
    unread_count: 0,
    status: "active",
    messages: [
      { id: "msg-014", sender: "patient", text: "السلام عليكم، هل متاح دفع قيمة الكشف أونلاين؟", timestamp: timeMinus(210) },
      { id: "msg-015", sender: "bot", text: "وعليكم السلام! نعم، يمكنك الدفع مسبقاً عبر بطاقة الائتمان أو المحافظ الإلكترونية والاستفادة من خصم 10%.", timestamp: timeMinus(200) },
      { id: "msg-016", sender: "patient", text: "هل يمكن الدفع فودافون كاش أو بطاقة فيزا؟", timestamp: timeMinus(180) }
    ]
  }
];

module.exports = mockConversations;
