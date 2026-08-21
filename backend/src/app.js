const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Middlewares
app.use(cors());
// Capture the raw request body alongside the parsed one — needed to verify
// the WhatsApp webhook's HMAC signature, which is computed over the exact
// raw bytes Meta sent, not a re-serialized version of the parsed JSON.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// Welcome Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Clinic OS (SCS) Backend Authentication Service is running.",
    available_endpoints: {
      admin_login: "POST /admin/v1/auth/login",
      admin_verify_2fa: "POST /admin/v1/auth/verify-2fa",
      clinic_login: "POST /v1/auth/login"
    }
  });
});

// Bind Routes
app.use(authRoutes);
app.use(adminRoutes);
app.use(webhookRoutes);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "هذا الرابط غير موجود في الخادم"
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "حدث خطأ غير متوقع في الخادم"
    }
  });
});

module.exports = app;
