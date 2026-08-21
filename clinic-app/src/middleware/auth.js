const jwt = require('jsonwebtoken');
const db = require('../db/connection');
require('dotenv').config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET is not set in the environment. Refusing to start with an insecure default secret.');
}

/**
 * Authentication Middleware to verify JWT and extract user context
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "لم يتم توفير رمز التحقق JWT Token"
      }
    });
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "رمز التحقق غير صالح أو منتهي الصلاحية"
        }
      });
    }
    
    // Attach user payload to request
    req.user = user;
    next();
  });
};

/**
 * Middleware to enforce Operator / Platform Owner access only
 */
const requireOperator = (req, res, next) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN_OPERATOR_ONLY",
        message: "هذا الإجراء مخصص لمهندسي عمليات المنصة فقط (Ops Only)"
      }
    });
  }
  next();
};

/**
 * Middleware to enforce Clinic / Tenant access only
 */
const requireClinicStaff = (req, res, next) => {
  if (!req.user || req.user.type !== 'clinic') {
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN_CLINIC_ONLY",
        message: "هذا الإجراء مخصص لمستخدمي العيادة فقط"
      }
    });
  }
  next();
};

/**
 * Middleware to enforce subscription-expiry: a suspended tenant is blocked
 * entirely; an expired-but-not-suspended tenant keeps read access (GET) but
 * loses write access until renewed, so staff can still see their data
 * (patients, records, appointment history) without being able to add to it.
 * Must run after authenticateToken (needs req.user.tenantId).
 */
const checkSubscriptionActive = async (req, res, next) => {
  try {
    const tenant = await db.get('SELECT status, expires_at FROM tenants WHERE id = ?', [req.user.tenantId]);
    if (!tenant) return next(); // tenant lookup failure shouldn't hard-lock staff out

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: { code: "SUBSCRIPTION_SUSPENDED", message: "تم تعليق اشتراك العيادة. يرجى التواصل مع إدارة المنصة." }
      });
    }

    const isExpired = tenant.expires_at && new Date(tenant.expires_at) < new Date();
    if (isExpired && req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        error: { code: "SUBSCRIPTION_EXPIRED", message: "انتهى اشتراك العيادة. الوضع الحالي للقراءة فقط — يرجى تجديد الاشتراك لاستئناف الاستخدام الكامل." }
      });
    }

    next();
  } catch (e) {
    console.error('checkSubscriptionActive error:', e);
    next(); // fail open on an unexpected DB error rather than lock staff out
  }
};

/**
 * Helper to set PostgreSQL Tenant RLS context in a transaction client
 * @param {import('pg').PoolClient} client 
 * @param {string} tenantId 
 */
const setTenantContext = async (client, tenantId) => {
  await client.query(`SET LOCAL app.current_tenant = $1`, [tenantId]);
};

module.exports = {
  authenticateToken,
  requireOperator,
  requireClinicStaff,
  checkSubscriptionActive,
  setTenantContext
};
