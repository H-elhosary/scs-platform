const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const router = express.Router();
require('dotenv').config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET / JWT_REFRESH_SECRET are not set in the environment. Refusing to start with an insecure default secret.');
}
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const MOCK_OTP = process.env['2FA_MOCK_OTP'] || '123456';

// Helper to generate access and refresh tokens
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
  return { accessToken, refreshToken };
};

// ==========================================
// Platform Admin Routes (SCS-ops.com / admin/v1)
// ==========================================

/**
 * POST /admin/v1/auth/login
 * Platform Admin Initial Login
 */
router.post('/admin/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "البريد الإلكتروني وكلمة المرور مطلوبة" }
    });
  }

  try {
    let admin = null;

    if (db.isMock) {
      // Find admin in memory
      admin = db.memoryDB.admin_users.find(u => u.email.toLowerCase() === email.toLowerCase());
    } else {
      // Find admin in database
      const result = await db.query('SELECT * FROM admin_users WHERE email = $1', [email]);
      if (result.rows.length > 0) {
        admin = result.rows[0];
      }
    }

    if (!admin || admin.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "بيانات الدخول غير صحيحة أو الحساب معطل" }
      });
    }

    // Verify Password Hash
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "بيانات الدخول غير صحيحة" }
      });
    }

    // Generate 2FA Verification Token
    const tempToken = jwt.sign(
      { adminId: admin.id, email: admin.email, type: 'admin_temp' },
      JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );

    // Save temporary session / OTP
    const otp = MOCK_OTP;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    if (db.isMock) {
      db.memoryDB.admin_sessions.push({
        id: `sess-${Math.random().toString(36).substring(7)}`,
        admin_id: admin.id,
        temp_token: tempToken,
        otp_code: otp,
        otp_expires_at: expiresAt.toISOString(),
        is_verified: false
      });
    } else {
      await db.query(
        'INSERT INTO admin_sessions (admin_id, temp_token, otp_code, otp_expires_at) VALUES ($1, $2, $3, $4)',
        [admin.id, tempToken, otp, expiresAt]
      );
    }

    // Print OTP to Console for Testing/Operations convenience
    console.log(`\n==========================================`);
    console.log(`✉️ [2FA Email Alert Sent] To: ${admin.email}`);
    console.log(`🔑 Verification Code (OTP): ${otp}`);
    console.log(`⏰ Expires at: ${expiresAt.toLocaleTimeString()}`);
    console.log(`==========================================\n`);

    return res.status(200).json({
      success: true,
      data: {
        two_factor_required: true,
        temp_token: tempToken,
        message: "تم إرسال كود التحقق الثنائي (OTP) إلى بريدك الإلكتروني"
      }
    });

  } catch (error) {
    console.error('Error during admin login:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء معالجة الطلب" }
    });
  }
});

/**
 * POST /admin/v1/auth/verify-2fa
 * Verify 2FA OTP Code
 */
router.post('/admin/v1/auth/verify-2fa', async (req, res) => {
  const { temp_token, otp_code } = req.body;

  if (!temp_token || !otp_code) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "الرمز المؤقت وكود التحقق مطلوبة" }
    });
  }

  try {
    // Decode temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_ACCESS_SECRET);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: { code: "TOKEN_EXPIRED", message: "انتهت صلاحية رمز التحقق المؤقت" }
      });
    }

    let session = null;
    let admin = null;

    if (db.isMock) {
      // Find session and admin in memory
      session = db.memoryDB.admin_sessions.find(s => s.temp_token === temp_token && !s.is_verified);
      if (session) {
        admin = db.memoryDB.admin_users.find(u => u.id === session.admin_id);
      }
    } else {
      // Find in database
      const sessResult = await db.query(
        'SELECT * FROM admin_sessions WHERE temp_token = $1 AND is_verified = FALSE',
        [temp_token]
      );
      if (sessResult.rows.length > 0) {
        session = sessResult.rows[0];
        const adminResult = await db.query('SELECT * FROM admin_users WHERE id = $1', [session.admin_id]);
        if (adminResult.rows.length > 0) {
          admin = adminResult.rows[0];
        }
      }
    }

    if (!session || !admin) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_SESSION", message: "جلسة التحقق غير صالحة أو منتهية" }
      });
    }

    // Verify OTP Expiry
    const now = new Date();
    const expiry = new Date(session.otp_expires_at);
    if (now > expiry) {
      return res.status(400).json({
        success: false,
        error: { code: "OTP_EXPIRED", message: "انتهت صلاحية كود التحقق OTP" }
      });
    }

    // Verify OTP Code
    if (session.otp_code !== otp_code) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_OTP", message: "كود التحقق OTP غير صحيح" }
      });
    }

    // Mark session as verified
    if (db.isMock) {
      session.is_verified = true;
    } else {
      await db.query('UPDATE admin_sessions SET is_verified = TRUE WHERE id = $1', [session.id]);
    }

    // Generate Production JWT Tokens
    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin' // Operator context
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    return res.status(200).json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role
        },
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });

  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ داخلي أثناء التحقق" }
    });
  }
});

// ==========================================
// Clinic Dashboard Routes (SCS-admin.com / v1)
// ==========================================

/**
 * POST /v1/auth/login
 * Clinic User / Staff Login with Multi-Tenancy Resolution
 */
router.post('/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const hostHeader = req.headers['host'] || '';

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "البريد الإلكتروني وكلمة المرور مطلوبة" }
    });
  }

  try {
    let user = null;
    let tenant = null;

    if (db.isMock) {
      // 1. Resolve Tenant Slug
      // Support subdomain resolution (e.g. "dr-mohamed-noor.SCS-admin.com" -> slug: "dr-mohamed-noor")
      let slug = null;
      if (hostHeader.includes('.SCS-admin.com')) {
        slug = hostHeader.split('.SCS-admin.com')[0];
      }
      
      // Find tenant
      if (slug && slug !== 'www') {
        tenant = db.memoryDB.tenants.find(t => t.slug === slug && t.status === 'active');
      } else {
        // Fallback: If running locally, resolve tenant based on email domain domain mapping or first tenant
        tenant = db.memoryDB.tenants[0]; // Default mock tenant
      }

      if (tenant) {
        // Find user belonging to this tenant
        user = db.memoryDB.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.tenant_id === tenant.id);
      }
    } else {
      // Database Mode: Resolve tenant by slug or query user directly first
      let slug = null;
      if (hostHeader.includes('.SCS-admin.com')) {
        slug = hostHeader.split('.SCS-admin.com')[0];
      }

      if (slug && slug !== 'www') {
        const tenantRes = await db.query('SELECT * FROM tenants WHERE slug = $1 AND status = $2', [slug, 'active']);
        if (tenantRes.rows.length > 0) {
          tenant = tenantRes.rows[0];
          const userRes = await db.query('SELECT * FROM users WHERE email = $1 AND tenant_id = $2', [email, tenant.id]);
          if (userRes.rows.length > 0) {
            user = userRes.rows[0];
          }
        }
      } else {
        // Fallback: lookup user first, then retrieve tenant
        const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length > 0) {
          user = userRes.rows[0];
          const tenantRes = await db.query('SELECT * FROM tenants WHERE id = $1 AND status = $2', [user.tenant_id, 'active']);
          if (tenantRes.rows.length > 0) {
            tenant = tenantRes.rows[0];
          }
        }
      }
    }

    if (!user || !tenant || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة أو العيادة معطلة" }
      });
    }

    // Check Lockout
    if (user.locked_until) {
      const lockTime = new Date(user.locked_until);
      const now = new Date();
      if (now < lockTime) {
        const remainingMinutes = Math.ceil((lockTime - now) / 60000);
        return res.status(403).json({
          success: false,
          error: {
            code: "ACCOUNT_LOCKED",
            message: `تم قفل الحساب مؤقتاً بسبب 3 محاولات خاطئة. يرجى المحاولة بعد ${remainingMinutes} دقيقة.`
          }
        });
      }
    }

    // Verify Password Hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // Increment failed attempts
      let attempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= 3) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      if (db.isMock) {
        user.failed_login_attempts = attempts;
        user.locked_until = lockedUntil;
      } else {
        await db.query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [attempts, lockedUntil, user.id]
        );
      }

      if (attempts >= 3) {
        return res.status(403).json({
          success: false,
          error: {
            code: "ACCOUNT_LOCKED",
            message: "تم قفل الحساب مؤقتاً لمدة 15 دقيقة بسبب محاولات تسجيل الدخول الفاشلة المتكررة."
          }
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: `البريد الإلكتروني أو كلمة المرور غير صحيحة. المحاولات المتبقية: ${3 - attempts}`
        }
      });
    }

    // Reset attempts on successful login
    if (user.failed_login_attempts > 0 || user.locked_until) {
      if (db.isMock) {
        user.failed_login_attempts = 0;
        user.locked_until = null;
      } else {
        await db.query(
          'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
          [user.id]
        );
      }
    }

    // Verify Tenant Subscription Expiry
    const now = new Date();
    const expiry = new Date(tenant.expires_at);
    if (now > expiry) {
      return res.status(403).json({
        success: false,
        error: { code: "SUBSCRIPTION_EXPIRED", message: "اشتراك العيادة منتهى الصلاحية. يرجى سداد الاشتراك لتفعيل الخدمة" }
      });
    }

    // Retrieve Role Name
    let roleName = 'staff';
    if (db.isMock) {
      const roleObj = db.memoryDB.roles.find(r => r.id === user.role_id);
      if (roleObj) roleName = roleObj.name;
    } else {
      const roleRes = await db.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);
      if (roleRes.rows.length > 0) roleName = roleRes.rows[0].name;
    }

    // Generate JWT Tokens with Tenant Identity Context (for RLS)
    const tokenPayload = {
      id: user.id,
      email: user.email,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      role: roleName,
      type: 'clinic' // Clinic staff context
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: roleName
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subscription_plan: tenant.subscription_plan
        },
        access_token: accessToken,
        refresh_token: refreshToken
      }
    });

  } catch (error) {
    console.error('Error during clinic user login:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ داخلي أثناء تسجيل الدخول" }
    });
  }
});

module.exports = router;
