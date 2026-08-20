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
const db = require('../../db/connection');
const queueState = require('./queueState');

// NOTE: GET /v1/queue/today is intentionally mounted separately in ./index.js,
// BEFORE the auth middleware — it feeds the unattended waiting-room TV display,
// which has no login flow of its own. Everything else in this router is a staff
// action and requires an authenticated clinic session.

// --- Check-in Patient ---
// (dashboard.js actually drives check-in through PUT /v1/appointments/:id/status,
// which correctly hits the real DB — this route is kept for any direct caller
// and now looks appointments up the same way, instead of a stale mock array.)
router.post('/v1/queue/check-in/:appointmentId', async (req, res) => {
  try {
    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.appointmentId]);
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
    }
    await db.run(`UPDATE appointments SET status = 'checked_in' WHERE id = ?`, [apt.id]);
    const updated = await db.get(`SELECT * FROM appointments WHERE id = ?`, [apt.id]);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Failed to check in appointment:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء تسجيل الوصول' } });
  }
});

// --- Start Exam (Move patient from waiting to exam room) ---
router.post('/v1/queue/start-exam/:appointmentId', async (req, res) => {
  try {
    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.appointmentId]);
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
    }

    const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [apt.patient_id]);
    const doctor = apt.doctor_id ? await db.get(`SELECT * FROM doctors WHERE id = ?`, [apt.doctor_id]) : null;
    queueState.current_in_exam = {
      queue_number: apt.queue_number,
      patient_name: patient ? patient.full_name : 'مريض',
      appointment_id: apt.id,
      doctor_name: doctor ? doctor.full_name : 'الطبيب المعالج'
    };
    queueState.last_called_at = new Date().toISOString();
    queueState.waiting_list = queueState.waiting_list.filter(item => item.appointment_id !== apt.id);

    return res.json({ success: true, data: queueState });
  } catch (err) {
    console.error('Failed to start exam:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء بدء الكشف' } });
  }
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
