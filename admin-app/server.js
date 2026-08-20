const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files with caching disabled to guarantee design system updates load instantly
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));


// Mount API Routes
const adminAuthRoutes = require('./src/routes/authRoutes');
const adminApiRoutes = require('./src/routes/adminRoutes');

app.use(adminAuthRoutes);
app.use(adminApiRoutes);

// Root — serve index.html (login page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  // If it looks like an API call, return JSON
  if (req.path.startsWith('/admin/') || req.path.startsWith('/v1/')) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "هذا الرابط غير موجود في الخادم" }
    });
  }
  // Otherwise serve the index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ غير متوقع في الخادم" }
  });
});

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`⚙️  Smart Clinic OS — Admin/Ops Console is running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`📡 API Base: http://localhost:${PORT}/admin/v1/`);
  console.log(`======================================================\n`);
});

module.exports = server;
