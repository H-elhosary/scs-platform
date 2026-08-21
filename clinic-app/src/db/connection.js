// =============================================
// Smart Clinic OS — Database Connection Layer
// Supports PostgreSQL & SQLite (Local Real Database on Disk)
// Automatic Table Initialization & Data Seeding
// =============================================

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

let dbType = 'sqlite'; // 'postgres' or 'sqlite'
let pgPool = null;
let sqliteDb = null;

const sqliteDbPath = path.join(__dirname, 'scs_database.sqlite');

// Initialize Database Connection
function initDatabase() {
  const hasPostgresConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME;

  if (hasPostgresConfig) {
    try {
      pgPool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });

      pgPool.query('SELECT NOW()', (err) => {
        if (err) {
          console.warn('⚠️ PostgreSQL connection failed. Falling back to Local SQLite Real Database.');
          setupSQLite();
        } else {
          console.log('🐘 Connected successfully to PostgreSQL Production Database.');
          dbType = 'postgres';
        }
      });
    } catch (e) {
      setupSQLite();
    }
  } else {
    setupSQLite();
  }
}

function setupSQLite() {
  dbType = 'sqlite';
  console.log(`🗄️ Initializing Real Local SQL Database at: ${sqliteDbPath}`);
  
  sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
    if (err) {
      console.error('❌ Failed to open SQLite database:', err);
    } else {
      console.log('✅ Connected to Real Local SQLite Database (Disk Storage).');
      // Without a busy timeout, a second connection hitting a locked DB
      // (e.g. a concurrent booking transaction, see appointmentRoutes.js)
      // fails immediately with SQLITE_BUSY instead of waiting briefly for
      // the lock to clear.
      sqliteDb.configure('busyTimeout', 5000);
      bootstrapSQLiteSchema();
    }
  });
}

function bootstrapSQLiteSchema() {
  sqliteDb.serialize(() => {
    // 1. Tenants
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      subscription_plan TEXT DEFAULT 'pro',
      specialty TEXT DEFAULT 'dental',
      allow_multi_doctor INTEGER DEFAULT 1,
      allow_insurance INTEGER DEFAULT 0,
      allow_refunds INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Users
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      status TEXT DEFAULT 'active',
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, email)
    )`);

    // 3. Doctors
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 4. Services
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      price REAL DEFAULT 0,
      duration_minutes INTEGER DEFAULT 20,
      category TEXT DEFAULT 'exam',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 5. Patients
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      full_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      age INTEGER,
      gender TEXT,
      email TEXT,
      blood_type TEXT,
      allergies TEXT,
      chronic_conditions TEXT,
      source TEXT DEFAULT 'manual',
      tags TEXT,
      total_visits INTEGER DEFAULT 0,
      last_visit_at TEXT,
      total_paid REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. Appointments
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      patient_id TEXT,
      doctor_id TEXT,
      service_id TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      end_time TEXT,
      status TEXT DEFAULT 'confirmed',
      visit_type TEXT DEFAULT 'exam',
      payment_method TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'pending',
      amount REAL DEFAULT 0,
      queue_number INTEGER,
      notes TEXT,
      booking_code TEXT,
      location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 7. Medical Records
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      appointment_id TEXT,
      doctor_id TEXT,
      subjective TEXT,
      objective TEXT,
      diagnosis_icd11 TEXT,
      plan TEXT,
      prescription_items TEXT,
      dental_records TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration: Add dental_records column if missing (for existing databases)
    sqliteDb.run(`ALTER TABLE medical_records ADD COLUMN dental_records TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        // Column already exists, ignore
      }
    });

    // 8. Tickets
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      tenant_name TEXT,
      type TEXT NOT NULL,
      type_ar TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      response_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 9. Conversations
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      patient_id TEXT,
      patient_name TEXT,
      channel TEXT DEFAULT 'whatsapp',
      bot_active INTEGER DEFAULT 1,
      last_message TEXT,
      last_message_at TEXT,
      unread_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 10. Messages
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 11. In-App Notifications
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 12. Admin Audit Logs
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT,
      action TEXT,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 13. Slot Locks — short-lived holds used by the WhatsApp/Telegram bot's
    // multi-turn booking flow (bookingService.js) to reserve a slot while a
    // patient is still mid-conversation, before the appointment row exists.
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS slot_locks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      patient_phone TEXT,
      expires_at TEXT NOT NULL
    )`);

    // 14. Invoices — created by the bot's online/cash-at-reception booking
    // paths (botController.js) and settled by the Paymob webhook.
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      appointment_id TEXT,
      patient_id TEXT,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed initial data if empty
    seedInitialData();
  });
}

function seedInitialData() {
  sqliteDb.get(`SELECT COUNT(*) as count FROM tenants`, (err, row) => {
    if (row && row.count === 0) {
      console.log('🌱 Seeding Multi-Specialty Clinic Database...');

      const DENTAL_TENANT = 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
      const ORTHO_TENANT  = 'b8c4d3e2-f6a7-8b9c-0d1e-2f3a4b5c6d7e';

      // ========== TENANT 1: عيادة أسنان ==========
      sqliteDb.run(
        `INSERT INTO tenants (id, name, slug, status, subscription_plan, specialty, allow_multi_doctor, allow_insurance, allow_refunds, expires_at)
         VALUES (?, ?, ?, 'active', 'pro', 'dental', 1, 0, 0, '2027-12-31T23:59:59Z')`,
        [DENTAL_TENANT, 'عيادة النور لطب الأسنان', 'dr-mohamed-noor']
      );

      // ========== TENANT 2: عيادة عظام ==========
      sqliteDb.run(
        `INSERT INTO tenants (id, name, slug, status, subscription_plan, specialty, allow_multi_doctor, allow_insurance, allow_refunds, expires_at)
         VALUES (?, ?, ?, 'active', 'pro', 'orthopedic', 1, 1, 0, '2027-12-31T23:59:59Z')`,
        [ORTHO_TENANT, 'عيادة الشفاء لجراحة العظام', 'dr-khalid-orthopedic']
      );

      // ========== USERS ==========
      const stmtUser = sqliteDb.prepare(`INSERT INTO users (id, tenant_id, full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      // Dental users
      stmtUser.run(['user-doctor-123', DENTAL_TENANT, 'د. محمد نور', 'clinic_info@noor.com', '+201012345678', '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6', 'owner']);
      stmtUser.run(['user-secretary-456', DENTAL_TENANT, 'سارة أحمد', 'sara@noor.com', '+201211112222', '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6', 'secretary']);
      // Orthopedic users
      stmtUser.run(['user-ortho-doc', ORTHO_TENANT, 'د. خالد عبد الرحمن', 'ortho@shefaa.com', '+201099887766', '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6', 'owner']);
      stmtUser.run(['user-ortho-sec', ORTHO_TENANT, 'نورا محمد', 'nora@shefaa.com', '+201033445566', '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6', 'secretary']);
      stmtUser.finalize();

      // ========== DOCTORS ==========
      const stmtDoc = sqliteDb.prepare(`INSERT INTO doctors (id, tenant_id, full_name, specialty) VALUES (?, ?, ?, ?)`);
      stmtDoc.run(['doc-1', DENTAL_TENANT, 'د. محمد نور', 'أسنان عام']);
      stmtDoc.run(['doc-2', DENTAL_TENANT, 'د. ليلى أحمد', 'تقويم أسنان']);
      stmtDoc.run(['doc-ortho-1', ORTHO_TENANT, 'د. خالد عبد الرحمن', 'جراحة عظام']);
      stmtDoc.run(['doc-ortho-2', ORTHO_TENANT, 'د. منى حسين', 'علاج طبيعي']);
      stmtDoc.finalize();

      // ========== SERVICES ==========
      const stmtSvc = sqliteDb.prepare(`INSERT INTO services (id, tenant_id, name, name_en, price, duration_minutes, category) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      // Dental services
      stmtSvc.run(['svc-001', DENTAL_TENANT, 'كشف عام', 'General Exam', 500, 20, 'exam']);
      stmtSvc.run(['svc-002', DENTAL_TENANT, 'متابعة مجانية', 'Free Follow-up', 0, 15, 'followup']);
      stmtSvc.run(['svc-003', DENTAL_TENANT, 'تنظيف أسنان', 'Teeth Cleaning', 800, 30, 'procedure']);
      stmtSvc.run(['svc-004', DENTAL_TENANT, 'حشو عصب', 'Root Canal', 2500, 60, 'procedure']);
      stmtSvc.run(['svc-005', DENTAL_TENANT, 'خلع ضرس', 'Tooth Extraction', 600, 30, 'procedure']);
      stmtSvc.run(['svc-006', DENTAL_TENANT, 'تبييض أسنان', 'Teeth Whitening', 3000, 45, 'cosmetic']);
      // Orthopedic services
      stmtSvc.run(['svc-o01', ORTHO_TENANT, 'كشف عظام', 'Orthopedic Exam', 600, 30, 'exam']);
      stmtSvc.run(['svc-o02', ORTHO_TENANT, 'متابعة', 'Follow-up', 300, 15, 'followup']);
      stmtSvc.run(['svc-o03', ORTHO_TENANT, 'أشعة سينية', 'X-Ray', 400, 20, 'diagnostic']);
      stmtSvc.run(['svc-o04', ORTHO_TENANT, 'علاج طبيعي', 'Physiotherapy', 800, 45, 'procedure']);
      stmtSvc.run(['svc-o05', ORTHO_TENANT, 'جبيرة', 'Cast/Splint', 1200, 30, 'procedure']);
      stmtSvc.run(['svc-o06', ORTHO_TENANT, 'حقن مفاصل', 'Joint Injection', 1500, 20, 'procedure']);
      stmtSvc.finalize();

      // ========== PATIENTS ==========
      const stmtPat = sqliteDb.prepare(`INSERT INTO patients (id, tenant_id, phone, full_name, first_name, last_name, age, gender, email, blood_type, allergies, chronic_conditions, source, tags, total_visits, total_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      // Dental patients
      stmtPat.run(['pat-001', DENTAL_TENANT, '+201098765432', 'أحمد محمد حسن', 'أحمد', 'حسن', 32, 'male', 'ahmed@example.com', 'A+', 'لا يوجد', 'لا يوجد', 'whatsapp_bot', 'VIP', 5, 2500]);
      stmtPat.run(['pat-002', DENTAL_TENANT, '+201112223344', 'سارة علي إبراهيم', 'سارة', 'إبراهيم', 28, 'female', 'sara@example.com', 'B+', 'بنسلين', 'لا يوجد', 'manual', '', 3, 1500]);
      stmtPat.run(['pat-003', DENTAL_TENANT, '+201055566677', 'محمود سعيد عبد الله', 'محمود', 'عبد الله', 45, 'male', null, 'O+', 'لا يوجد', 'ضغط دم مرتفع', 'whatsapp_bot', '', 8, 4000]);
      // Orthopedic patients
      stmtPat.run(['pat-o01', ORTHO_TENANT, '+201077788899', 'عمرو طارق السيد', 'عمرو', 'السيد', 55, 'male', 'amr@example.com', 'A-', 'لا يوجد', 'خشونة ركبة', 'manual', '', 6, 3600]);
      stmtPat.run(['pat-o02', ORTHO_TENANT, '+201066677788', 'فاطمة حسن علي', 'فاطمة', 'علي', 42, 'female', 'fatma@example.com', 'O+', 'لا يوجد', 'انزلاق غضروفي', 'whatsapp_bot', 'VIP', 4, 2400]);
      stmtPat.finalize();

      // ========== APPOINTMENTS ==========
      const today = new Date().toISOString().split('T')[0];
      const stmtApt = sqliteDb.prepare(`INSERT INTO appointments (id, tenant_id, patient_id, doctor_id, service_id, date, time, end_time, status, visit_type, payment_method, payment_status, amount, queue_number, notes, booking_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      // Dental appointments
      stmtApt.run(['apt-001', DENTAL_TENANT, 'pat-001', 'doc-1', 'svc-001', today, '09:00', '09:20', 'completed', 'exam', 'cash', 'paid', 500, 1, '', 'BK-7001']);
      stmtApt.run(['apt-002', DENTAL_TENANT, 'pat-002', 'doc-1', 'svc-004', today, '11:00', '12:00', 'confirmed', 'exam', 'online', 'paid', 2250, 2, 'حشو عصب ضرس سفلي', 'BK-7005']);
      stmtApt.run(['apt-003', DENTAL_TENANT, 'pat-003', 'doc-1', 'svc-001', today, '12:30', '12:50', 'confirmed', 'exam', 'cash', 'pending', 500, 3, '', 'BK-7006']);
      // Orthopedic appointments
      stmtApt.run(['apt-o01', ORTHO_TENANT, 'pat-o01', 'doc-ortho-1', 'svc-o01', today, '10:00', '10:30', 'confirmed', 'exam', 'cash', 'paid', 600, 1, 'ألم ركبة يمنى', 'BK-O001']);
      stmtApt.run(['apt-o02', ORTHO_TENANT, 'pat-o02', 'doc-ortho-1', 'svc-o06', today, '11:00', '11:20', 'confirmed', 'exam', 'cash', 'pending', 1500, 2, 'حقن مفصل الكتف', 'BK-O002']);
      stmtApt.finalize();

      console.log('✅ Multi-Specialty Database Seed Completed (Dental + Orthopedic).');
    }
  });
}

// Initialize on load
initDatabase();

// Promisified Database API Helpers
const db = {
  isMock: false,
  getDbType: () => dbType,

  // Execute SELECT returning array of rows
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'postgres' && pgPool) {
        pgPool.query(sql, params, (err, res) => {
          if (err) reject(err);
          else resolve(res.rows);
        });
      } else if (sqliteDb) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        resolve([]);
      }
    });
  },

  // Execute SELECT returning single row
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'postgres' && pgPool) {
        pgPool.query(sql, params, (err, res) => {
          if (err) reject(err);
          else resolve(res.rows[0] || null);
        });
      } else if (sqliteDb) {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      } else {
        resolve(null);
      }
    });
  },

  // Execute INSERT / UPDATE / DELETE
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (dbType === 'postgres' && pgPool) {
        pgPool.query(sql, params, (err, res) => {
          if (err) reject(err);
          else resolve({ changes: res.rowCount });
        });
      } else if (sqliteDb) {
        sqliteDb.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      } else {
        resolve({ changes: 0 });
      }
    });
  },

  // Legacy query compatibility helper
  query: async (text, params = []) => {
    if (dbType === 'postgres' && pgPool) {
      return pgPool.query(text, params);
    }
    const rows = await db.all(text, params);
    return { rows, rowCount: rows.length };
  }
};

module.exports = db;
