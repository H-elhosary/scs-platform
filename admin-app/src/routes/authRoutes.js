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
// Platform Admin Login Routes
// ==========================================

/**
 * POST /admin/v1/auth/login
 * Platform Admin Initial Login (Step 1: email + password → temp_token)
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
    let admin = db.memoryDB.admin_users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!admin) {
      try {
        const query = db.getDbType && db.getDbType() === 'postgres'
          ? 'SELECT * FROM admin_users WHERE email = $1'
          : 'SELECT * FROM admin_users WHERE email = ?';
        const result = await db.query(query, [email]);
        if (result.rows && result.rows.length > 0) {
          admin = result.rows[0];
        }
      } catch (e) {}
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }
      });
    }

    let passwordValid = false;
    try {
      passwordValid = await bcrypt.compare(password, admin.password_hash);
    } catch(e) {}

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }
      });
    }

    // Generate temporary token for 2FA
    const tempToken = jwt.sign(
      { adminId: admin.id, email: admin.email, pending2FA: true },
      JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );

    // Mock: Print OTP to console
    console.log(`\n==========================================`);
    console.log(`📧 [2FA Mock] Verification code for ${admin.email}: ${MOCK_OTP}`);
    console.log(`==========================================\n`);

    return res.status(200).json({
      success: true,
      data: {
        two_factor_required: true,
        temp_token: tempToken
      }
    });

  } catch (err) {
    console.error('Admin Login Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ أثناء معالجة تسجيل الدخول" }
    });
  }
});

/**
 * POST /admin/v1/auth/verify-2fa
 * Platform Admin 2FA Verification (Step 2: temp_token + OTP → access_token)
 */
router.post('/admin/v1/auth/verify-2fa', async (req, res) => {
  const { temp_token, otp_code } = req.body;

  if (!temp_token || !otp_code) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "الرمز المؤقت وكود التحقق مطلوبان" }
    });
  }

  try {
    // Verify temp token
    const decoded = jwt.verify(temp_token, JWT_ACCESS_SECRET);
    if (!decoded.pending2FA) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_TOKEN", message: "رمز مؤقت غير صالح" }
      });
    }

    // Verify OTP
    if (otp_code !== MOCK_OTP) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_OTP", message: "كود التحقق الثنائي غير صحيح أو منتهي الصلاحية" }
      });
    }

    // Find admin — check the in-memory seed accounts first, then fall back to
    // the real DB (operators created via admin-users management only live there).
    let admin = db.memoryDB.admin_users.find(u => u.id === decoded.adminId);

    if (!admin) {
      try {
        admin = await db.get('SELECT * FROM admin_users WHERE id = ?', [decoded.adminId]);
      } catch (e) {}
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: { code: "ADMIN_NOT_FOUND", message: "المسؤول غير موجود" }
      });
    }

    if (admin.status === 'inactive') {
      return res.status(403).json({
        success: false,
        error: { code: "ACCOUNT_INACTIVE", message: "هذا الحساب موقوف. يرجى التواصل مع مشغل Super Admin." }
      });
    }

    // Generate full tokens
    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin'
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    // Log session
    if (db.isMock) {
      db.memoryDB.admin_sessions.push({
        admin_id: admin.id,
        access_token: accessToken,
        created_at: new Date().toISOString()
      });
    }

    console.log(`✅ [Admin 2FA Success] ${admin.full_name} verified successfully.`);

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

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        error: { code: "TOKEN_EXPIRED", message: "انتهت صلاحية الرمز المؤقت. يرجى إعادة تسجيل الدخول." }
      });
    }
    console.error('2FA Verification Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ أثناء التحقق" }
    });
  }
});

module.exports = router;
