const { Pool } = require('pg');
require('dotenv').config();

let pool = null;
let isMock = false;

// Mock database (In-memory fallback for testing out-of-the-box)
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
  plans: [
    {
      id: "basic",
      name: "Basic",
      price_egp: 2500,
      price_usd: 50,
      allow_multi_doctor: false,
      allow_insurance: false,
      allow_refunds: false,
      allow_whatsapp: false,
      allow_telegram: false,
      allow_analytics: false,
      allow_voice_bot: false,
      allow_custom_branding: false
    },
    {
      id: "pro",
      name: "Pro",
      price_egp: 5000,
      price_usd: 100,
      allow_multi_doctor: true,
      allow_insurance: false,
      allow_refunds: false,
      allow_whatsapp: true,
      allow_telegram: false,
      allow_analytics: true,
      allow_voice_bot: false,
      allow_custom_branding: false
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price_egp: 12500,
      price_usd: 250,
      allow_multi_doctor: true,
      allow_insurance: true,
      allow_refunds: true,
      allow_whatsapp: true,
      allow_telegram: true,
      allow_analytics: true,
      allow_voice_bot: true,
      allow_custom_branding: true
    }
  ],
  tenants: [
    {
      id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      name: "عيادة النور لطب الأسنان",
      slug: "dr-mohamed-noor",
      status: "active",
      subscription_plan: "pro",
      specialty: "dental",
      allow_multi_doctor: true,
      allow_insurance: false,
      allow_refunds: false,
      allow_whatsapp: true,
      allow_telegram: false,
      allow_analytics: true,
      allow_voice_bot: false,
      allow_custom_branding: false,
      settings: {
        notification_settings: {
          patient_email_booking_confirm: true,
          patient_whatsapp_booking_confirm: true,
          patient_email_prescription: true,
          patient_email_invoice: true,
          doctor_email_new_booking: true,
          doctor_whatsapp_new_booking: false,
          doctor_email_daily_report: true,
          doctor_email_weekly_report: true
        }
      },
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  roles: [
    { id: "b1111111-2222-3333-4444-555555555555", tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d", name: "owner" },
    { id: "b2222222-2222-3333-4444-555555555555", tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d", name: "secretary" }
  ],
  users: [
    {
      id: "user-doctor-123",
      tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      role_id: "b1111111-2222-3333-4444-555555555555",
      full_name: "د. محمد نور",
      email: "clinic_info@noor.com",
      phone: "+201012345678",
      password_hash: "$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6",
      status: "active",
      failed_login_attempts: 0,
      locked_until: null
    },
    {
      id: "user-secretary-456",
      tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      role_id: "b2222222-2222-3333-4444-555555555555",
      full_name: "سارة أحمد",
      email: "sara@noor.com",
      phone: "+201211112222",
      password_hash: "$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6",
      status: "active",
      failed_login_attempts: 0,
      locked_until: null
    }
  ],
  admin_sessions: [],
  subscription_history: [],
  admin_audit_logs: [],
  patients: [],
  appointments: [],
  invoices: [],
  slot_locks: [],
  doctors: [
    { id: "doc-1", tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d", full_name: "د. محمد نور", specialty: "أسنان عام" },
    { id: "doc-2", tenant_id: "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d", full_name: "د. ليلى أحمد", specialty: "تقويم أسنان" }
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

  // Test the connection
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
  // Helper to query the DB (abstracted to support both pg and in-memory fallback)
  query: async (text, params) => {
    if (!isMock && pool) {
      return pool.query(text, params);
    }
    throw new Error('Running in Mock Mode. Use memoryDB helpers instead.');
  }
};
