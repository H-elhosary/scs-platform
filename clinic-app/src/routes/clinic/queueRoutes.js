// =============================================
// Smart Clinic OS — Queue Routes
// GET    /v1/queue/today
// POST   /v1/queue/check-in/:appointmentId
// POST   /v1/queue/start-exam/:appointmentId
// POST   /v1/queue/call-next
// POST   /v1/queue/call-next-patient
// POST   /v1/sync
// =============================================

const express = require('express');
const router = express.Router();
const data = require('../../data');
const queueState = require('./queueState');

// --- Get Queue Status ---
router.get('/v1/queue/today', (req, res) => {
  return res.json({ success: true, data: queueState });
});

// --- Check-in Patient ---
router.post('/v1/queue/check-in/:appointmentId', (req, res) => {
  const apt = data.mockAppointments.find(a => a.id === req.params.appointmentId);
  if (!apt) {
    return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  }
  apt.status = 'checked_in';
  return res.json({ success: true, data: apt });
});

// --- Start Exam (Move patient from waiting to exam room) ---
router.post('/v1/queue/start-exam/:appointmentId', (req, res) => {
  const apt = data.mockAppointments.find(a => a.id === req.params.appointmentId);
  if (!apt) {
    return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  }

  const patient = data.mockPatients.find(p => p.id === apt.patient_id);
  queueState.current_in_exam = {
    queue_number: apt.queue_number,
    patient_name: patient ? patient.full_name : 'مريض',
    appointment_id: apt.id,
    doctor_name: "د. محمد نور"
  };
  queueState.last_called_at = new Date().toISOString();
  queueState.waiting_list = queueState.waiting_list.filter(item => item.appointment_id !== apt.id);

  return res.json({ success: true, data: queueState });
});

// --- Call Next (legacy endpoint) ---
router.post('/v1/queue/call-next', (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      called_patient: { queue_number: 14, display_name: "محمد أ." },
      websocket_broadcast_sent: true
    }
  });
});

// --- Call Next Patient (full implementation) ---
router.post('/v1/queue/call-next-patient', (req, res) => {
  if (queueState.waiting_list.length === 0) {
    return res.json({
      success: true,
      data: { message: "لا يوجد مرضى في قائمة الانتظار", called_patient: null }
    });
  }

  const next = queueState.waiting_list.shift();
  queueState.current_in_exam = { ...next, doctor_name: "د. محمد نور" };
  queueState.last_called_at = new Date().toISOString();

  return res.json({
    success: true,
    data: {
      called_patient: next,
      current_in_exam: queueState.current_in_exam,
      remaining: queueState.waiting_list.length,
      websocket_broadcast_sent: true
    }
  });
});

// --- Offline Sync ---
router.post('/v1/sync', (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      synced_count: (req.body.actions || []).length,
      conflicts: []
    }
  });
});

module.exports = router;
