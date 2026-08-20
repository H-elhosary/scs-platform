// =============================================
// Smart Clinic OS — Clinic Routes Index
// Central entry point that mounts all clinic sub-routes
// =============================================

const express = require('express');
const router = express.Router();
const { authenticateToken, requireClinicStaff } = require('../../middleware/auth');
const queueState = require('./queueState');

// Import all clinic route modules
const dashboardRoutes = require('./dashboardRoutes');
const patientRoutes = require('./patientRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const queueRoutes = require('./queueRoutes');
const settingsRoutes = require('./settingsRoutes');
const conversationRoutes = require('./conversationRoutes');
const ticketRoutes = require('./ticketRoutes');
const doctorRoutes = require('./doctorRoutes');
const notificationRoutes = require('./notificationRoutes');

// Public: read-only queue status feeds the unattended waiting-room TV display,
// which has no login flow of its own. Mounted BEFORE the auth gate below.
router.get('/v1/queue/today', (req, res) => {
  return res.json({ success: true, data: queueState });
});

// Everything below this line is the clinic staff dashboard API and requires
// a logged-in clinic session — previously none of these routes checked auth at all.
router.use(authenticateToken, requireClinicStaff);

// Never trust a client-supplied x-tenant-id: force it to the tenant encoded in
// the caller's own verified JWT so one clinic's staff cannot read/write another
// clinic's data by sending a different header value.
router.use((req, res, next) => {
  req.headers['x-tenant-id'] = req.user.tenantId;
  next();
});

// Mount all routes
router.use(dashboardRoutes);
router.use(patientRoutes);
router.use(appointmentRoutes);
router.use(queueRoutes);
router.use(settingsRoutes);
router.use(conversationRoutes);
router.use(ticketRoutes);
router.use(doctorRoutes);
router.use(notificationRoutes);

module.exports = router;
