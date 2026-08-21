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
// tables. Ensure the admin-only tables (audit trail, admin accounts, plans,
// subscription/broadcast history) exist too, so admin-app's own queries
// don't fail against a missing table, and extend the shared `tickets` table
// with SLA/assignee columns the same non-destructive way.
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
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price_egp REAL DEFAULT 0,
      price_usd REAL DEFAULT 0,
      allow_multi_doctor INTEGER DEFAULT 0,
      allow_insurance INTEGER DEFAULT 0,
      allow_refunds INTEGER DEFAULT 0,
      allow_whatsapp INTEGER DEFAULT 0,
      allow_telegram INTEGER DEFAULT 0,
      allow_analytics INTEGER DEFAULT 0,
      allow_voice_bot INTEGER DEFAULT 0,
      allow_custom_branding INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS subscription_history (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_plan TEXT,
      new_plan TEXT,
      old_expires_at TEXT,
      new_expires_at TEXT,
      reason TEXT,
      changed_by_admin_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS admin_broadcast_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      filter_plan TEXT DEFAULT 'all',
      filter_status TEXT DEFAULT 'all',
      channel TEXT DEFAULT 'both',
      recipient_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ticket SLA/assignee columns — tickets is bootstrapped by clinic-app,
    // so admin-app extends it non-destructively (ALTER TABLE, swallowing
    // the "duplicate column" error on repeat boots).
    ['priority TEXT DEFAULT \'normal\'', 'assigned_to TEXT', 'due_at TEXT'].forEach(colDef => {
      sqliteDb.run(`ALTER TABLE tickets ADD COLUMN ${colDef}`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error('Failed to extend tickets table:', err.message);
      });
    });

    // `tenants`/`users` (also bootstrapped by clinic-app) never got an
    // `updated_at` column, so every admin-app route that does
    // `UPDATE ... SET updated_at = CURRENT_TIMESTAMP` 500s against the real
    // schema. Same non-destructive extension pattern as above.
    sqliteDb.run(`ALTER TABLE tenants ADD COLUMN updated_at TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.error('Failed to extend tenants table:', err.message);
    });
    sqliteDb.run(`ALTER TABLE users ADD COLUMN updated_at TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) console.error('Failed to extend users table:', err.message);
    });

    // Seed admin_users from the in-memory accounts so the audit-logs JOIN can
    // resolve operator names even before any write path targets this table.
    const stmt = sqliteDb.prepare(`INSERT OR IGNORE INTO admin_users (id, email, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, ?)`);
    memoryDB.admin_users.forEach(u => {
      stmt.run(u.id, u.email, u.password_hash, u.full_name, u.role, u.status);
    });
    stmt.finalize();

    // Seed plans from the same catalog used by the in-memory fallback, so
    // the real `plans` table starts populated with Basic/Pro/Enterprise at
    // their existing prices/feature-defaults. IDs must stay stable since
    // `tenants.subscription_plan` free-text-references them.
    const planStmt = sqliteDb.prepare(`INSERT OR IGNORE INTO plans
      (id, name, price_egp, price_usd, allow_multi_doctor, allow_insurance, allow_refunds, allow_whatsapp, allow_telegram, allow_analytics, allow_voice_bot, allow_custom_branding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    memoryDB.plans.forEach(p => {
      planStmt.run(p.id, p.name, p.price_egp, p.price_usd,
        p.allow_multi_doctor ? 1 : 0, p.allow_insurance ? 1 : 0, p.allow_refunds ? 1 : 0,
        p.allow_whatsapp ? 1 : 0, p.allow_telegram ? 1 : 0, p.allow_analytics ? 1 : 0,
        p.allow_voice_bot ? 1 : 0, p.allow_custom_branding ? 1 : 0);
    });
    planStmt.finalize();
  });
}

initDatabase();

// Promisified DB helpers
const db = {
  get isMock() { return isMock; },
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
      // An UPDATE/INSERT/DELETE ... RETURNING statement yields rows just like a
      // SELECT does — route it through db.all() too, or the RETURNING data is
      // silently dropped (db.run() only reports lastID/changes, never rows).
      const isSelect = text.trim().toUpperCase().startsWith('SELECT');
      const hasReturning = /\bRETURNING\b/i.test(text);
      if (isSelect || hasReturning) {
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
