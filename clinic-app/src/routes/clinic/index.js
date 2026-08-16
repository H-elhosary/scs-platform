// =============================================
// Smart Clinic OS — Clinic Routes Index
// Central entry point that mounts all clinic sub-routes
// =============================================

const express = require('express');
const router = express.Router();

// Import all clinic route modules
const dashboardRoutes = require('./dashboardRoutes');
const patientRoutes = require('./patientRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const queueRoutes = require('./queueRoutes');
const settingsRoutes = require('./settingsRoutes');
const conversationRoutes = require('./conversationRoutes');
const ticketRoutes = require('./ticketRoutes');
const doctorRoutes = require('./doctorRoutes');

// Mount all routes
router.use(dashboardRoutes);
router.use(patientRoutes);
router.use(appointmentRoutes);
router.use(queueRoutes);
router.use(settingsRoutes);
router.use(conversationRoutes);
router.use(ticketRoutes);
router.use(doctorRoutes);

module.exports = router;
