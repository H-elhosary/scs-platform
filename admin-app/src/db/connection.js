// =============================================
// Smart Clinic OS (Admin/Ops) — Database Connection Layer
// Connected directly to the Real SQLite Database (scs_database.sqlite)
// and PostgreSQL if configured in .env
// =============================================

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

let dbType = 'sqlite'; // 'postgres' or 'sqlite'
let pgPool = null;
let sqliteDb = null;
let isMock = false;

// Shared SQLite database path with clinic-app
const sqliteDbPath = path.resolve(__dirname, '../../../clinic-app/src/db/scs_database.sqlite');

const memoryDB = {
  admin_users: [
    {
      id: "admin-uuid-super",
      email: "ops@SCS-ops.com",
      password_hash: "$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6", // "SecurePassword123!"
      full_name: "أحمد مشغل النظام",
      role: "super_admin",
      status: "active"
    },
    {
      id: "admin-uuid-hazem",
      email: "hazemelhosary3@gmail.com",
      password_hash: "$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6", // "SecurePassword123!"
      full_name: "د. حازم الحصري",
      role: "super_admin",
      status: "active"
    },
    {
      id: "admin-uuid-test",
      email: "test12316193@gmail.com",
      password_hash: "$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6", // "SecurePassword123!"
      full_name: "د. حازم (حساب تجريبي)",
      role: "super_admin",
      status: "active"
    }
  ],
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
  admin_sessions: [],
  subscription_history: [],
  admin_audit_logs: [],
  tenants: [],
  users: [],
  doctors: [],
  tickets: [],
  patients: [],
  appointments: []
};

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
          console.warn('⚠️ Admin PostgreSQL connection failed. Falling back to Shared SQLite Real Database.');
          setupSQLite();
        } else {
          console.log('🐘 Admin connected successfully to PostgreSQL Production Database.');
          dbType = 'postgres';
          isMock = false;
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
  console.log(`🗄️ Admin connecting to Real SQLite Database at: ${sqliteDbPath}`);
  
  sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
    if (err) {
      console.error('❌ Failed to open SQLite database in admin:', err);
      isMock = true;
    } else {
      console.log('✅ Admin Connected to Real Shared SQLite Database.');
      isMock = false;
      ensureAdminTables();
    }
  });
}

// admin-app shares clinic-app's SQLite file, which only bootstraps clinic
// tables. Ensure the admin-only tables (audit trail, admin accounts) exist
// too, so admin_audit_logs reads/writes don't fail against a missing table.
function ensureAdminTables() {
  sqliteDb.serialize(() => {
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed admin_users from the in-memory accounts so the audit-logs JOIN can
    // resolve operator names even before any write path targets this table.
    const stmt = sqliteDb.prepare(`INSERT OR IGNORE INTO admin_users (id, email, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, ?)`);
    memoryDB.admin_users.forEach(u => {
      stmt.run(u.id, u.email, u.password_hash, u.full_name, u.role, u.status);
    });
    stmt.finalize();
  });
}

initDatabase();

// Promisified DB helpers
const db = {
  isMock: false,
  memoryDB,
  getDbType: () => dbType,

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

  query: async (text, params = []) => {
    if (dbType === 'postgres' && pgPool) {
      return pgPool.query(text, params);
    }
    if (sqliteDb) {
      const isSelect = text.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        const rows = await db.all(text, params);
        return { rows, rowCount: rows.length };
      } else {
        const res = await db.run(text, params);
        return { rows: [], rowCount: res.changes };
      }
    }
    return { rows: [], rowCount: 0 };
  }
};

module.exports = db;
