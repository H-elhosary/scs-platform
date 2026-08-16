const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your_jwt_access_secret_key_12345';

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
  setTenantContext
};
