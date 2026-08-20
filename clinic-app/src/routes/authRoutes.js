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

// Helper to generate access and refresh tokens
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
  return { accessToken, refreshToken };
};

// ==========================================
// Clinic Staff Login
// ==========================================

/**
 * POST /v1/auth/login
 * Clinic Dashboard Login
 */
router.post('/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "البريد الإلكتروني وكلمة المرور مطلوبة" }
    });
  }

  try {
    let matchedUser = null;
    let matchedTenant = null;

    const userRows = await db.all('SELECT * FROM users WHERE LOWER(email) = ?', [email.toLowerCase()]);
    
    for (const u of userRows) {
      try {
        const isValid = await bcrypt.compare(password, u.password_hash);
        if (isValid) {
          matchedUser = u;
          matchedTenant = await db.get('SELECT * FROM tenants WHERE id = ?', [u.tenant_id]);
          break;
        }
      } catch (e) {}
    }

    if (!matchedUser) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }
      });
    }

    const user = matchedUser;
    const tenant = matchedTenant;

    // Get role
    let roleName = user.role || 'staff';

    // Generate token
    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: roleName,
      type: 'clinic'
    };

    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    console.log(`✅ [Clinic Login Success] ${user.full_name} (${email}) - Specialty: ${tenant?.specialty || 'dental'}`);

    return res.status(200).json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: roleName
        },
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subscription_plan: tenant.subscription_plan,
          specialty: tenant.specialty || 'dental',
          phone: user.phone || '+201012345678'
        } : null
      }
    });

  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ أثناء معالجة تسجيل الدخول" }
    });
  }
});

module.exports = router;
