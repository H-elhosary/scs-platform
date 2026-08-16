const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let isMock = false;

// Mock database (In-memory fallback for admin ops)
const memoryDB = {
  admin_users: [
    {
      id: "admin-uuid-super",
      email: "ops@SCS-ops.com",
      password_hash: "$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6", // "SecurePassword123!"
      full_name: "أحمد مشغل النظام",
      role: "super_admin",
      status: "active"
    }
  ],
  admin_sessions: [],
  plans: [
    {
      id: "basic", name: "Basic", price_egp: 2500, price_usd: 50,
      allow_multi_doctor: false, allow_insurance: false, allow_refunds: false,
      allow_whatsapp: false, allow_telegram: false, allow_analytics: false,
      allow_voice_bot: false, allow_custom_branding: false
    },
    {
      id: "pro", name: "Pro", price_egp: 5000, price_usd: 100,
      allow_multi_doctor: true, allow_insurance: false, allow_refunds: false,
      allow_whatsapp: true, allow_telegram: false, allow_analytics: true,
      allow_voice_bot: false, allow_custom_branding: false
    },
    {
      id: "enterprise", name: "Enterprise", price_egp: 12500, price_usd: 250,
      allow_multi_doctor: true, allow_insurance: true, allow_refunds: true,
      allow_whatsapp: true, allow_telegram: true, allow_analytics: true,
      allow_voice_bot: true, allow_custom_branding: true
    }
  ],
  tenants: [
    {
      id: "tenant-uuid-noor",
      name: "عيادة النور لطب الأسنان",
      slug: "dr-mohamed-noor",
      status: "active",
      subscription_plan: "pro",
      specialty: "dental",
      allow_multi_doctor: true,
      allow_insurance: false,
      allow_refunds: false,
      expires_at: "2027-07-01T20:00:00Z",
      owner_name: "د. محمد نور",
      owner_email: "clinic_info@noor.com",
      owner_phone: "+201012345678"
    },
    {
      id: "tenant-uuid-ahmed",
      name: "عيادة د. أحمد التجميلية",
      slug: "dr-ahmed-derma",
      status: "active",
      subscription_plan: "enterprise",
      specialty: "dermatology",
      allow_multi_doctor: true,
      allow_insurance: true,
      allow_refunds: true,
      expires_at: "2026-05-01T00:00:00Z",
      owner_name: "د. أحمد التجميلي",
      owner_email: "dr.ahmed@derma.com",
      owner_phone: "+201211112222"
    }
  ],
  roles: [],
  users: [],
  patients: [],
  appointments: [],
  admin_sessions: [],
  subscription_history: [],
  admin_audit_logs: [],
  doctors: [
    { id: "doc-1", tenant_id: "tenant-uuid-noor", full_name: "د. محمد نور", specialty: "أسنان عام" },
    { id: "doc-2", tenant_id: "tenant-uuid-noor", full_name: "د. ليلى أحمد", specialty: "تقويم أسنان" }
  ],
  tickets: [
    {
      id: "TKT-1001", tenant_id: "tenant-uuid-noor", tenant_name: "عيادة د. نور لطب الأسنان",
      type: "upgrade", type_ar: "ترقية الباقة",
      title: "طلب ترقية لباقة المؤسسات لتفعيل التأمين الطبي",
      description: "نريد ترقية اشتراكنا الحالي إلى باقة المؤسسات (Enterprise) لتمكين ميزات التأمين الطبي والاسترداد الإلكتروني للمرضى.",
      status: "pending", created_at: "2026-07-04T12:00:00Z", response_notes: ""
    },
    {
      id: "TKT-1002", tenant_id: "tenant-uuid-noor", tenant_name: "عيادة د. نور لطب الأسنان",
      type: "maintenance", type_ar: "طلب صيانة",
      title: "مشكلة في تحميل بعض التقارير المالية",
      description: "التقرير المالي الأسبوعي لم يظهر مساء الجمعة الماضي. يرجى التحقق.",
      status: "resolved", created_at: "2026-07-03T09:30:00Z",
      response_notes: "تم فحص المشكلة في خادم التحليلات وإعادة إرسال التقرير يدوياً. يجب أن يعمل بشكل سليم الآن."
    }
  ]
};

// Check if PostgreSQL configurations are set in .env
const hasPostgresConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME;

if (hasPostgresConfig) {
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.warn('⚠️ WARNING: Failed to connect to PostgreSQL. Falling back to In-Memory DB Mode.');
      console.error('Error details:', err.message);
      isMock = true;
    } else {
      console.log('🐘 PostgreSQL connected successfully. Running in Database Mode.');
      isMock = false;
    }
  });
} else {
  console.log('ℹ️ No PostgreSQL credentials found. Starting in In-Memory DB Mode.');
  isMock = true;
}

module.exports = {
  isMock,
  memoryDB,
  query: async (text, params) => {
    if (!isMock && pool) {
      return pool.query(text, params);
    }
    throw new Error('Running in Mock Mode. Use memoryDB helpers instead.');
  }
};
