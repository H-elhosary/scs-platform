// =============================================
// Smart Clinic OS — Appointment Routes (Real Database Mode)
// GET    /v1/appointments
// GET    /v1/appointments/:id
// POST   /v1/appointments
// PUT    /v1/appointments/:id
// PUT    /v1/appointments/:id/status
// DELETE /v1/appointments/:id
// POST   /v1/appointments/:appointment_id/consultation
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const queueState = require('./queueState');
const { encrypt } = require('../../utils/crypto');
const emailService = require('../../services/emailService');
const notificationService = require('../../services/notificationService');

// Helper: convert "HH:MM" to total minutes
const getMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// --- List Appointments (with filters) ---
router.get('/v1/appointments', async (req, res) => {
  try {
    const { date, date_from, date_to, status, doctor_id } = req.query;
    let sql = `
      SELECT a.*, 
             p.full_name as patient_name, p.phone as patient_phone, p.gender as patient_gender, p.age as patient_age,
             s.name as service_name, s.duration_minutes as service_duration
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.tenant_id = ?
    `;
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const params = [tenantId];

    if (date) { sql += ` AND a.date = ?`; params.push(date); }
    if (date_from) { sql += ` AND a.date >= ?`; params.push(date_from); }
    if (date_to) { sql += ` AND a.date <= ?`; params.push(date_to); }
    if (status) { sql += ` AND a.status = ?`; params.push(status); }
    if (doctor_id) { sql += ` AND a.doctor_id = ?`; params.push(doctor_id); }

    sql += ` ORDER BY a.date DESC, a.time ASC`;

    const appointments = await db.all(sql, params);
    return res.json({ success: true, data: appointments });
  } catch (err) {
    console.error('Failed to get appointments:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ في قاعدة البيانات' } });
  }
});

// --- Get Single Appointment ---
router.get('/v1/appointments/:id', async (req, res) => {
  try {
    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.id]);
    if (!apt) {
      return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
    }
    const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [apt.patient_id]);
    const service = await db.get(`SELECT * FROM services WHERE id = ?`, [apt.service_id]);

    return res.json({ success: true, data: { ...apt, patient, service } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء جلب تفاصيل الموعد' } });
  }
});

// --- Create Appointment (with conflict & past date detection) ---
router.post('/v1/appointments', async (req, res) => {
  try {
    const { patient_id, doctor_id, service_id, date, time, visit_type, payment_method, notes, location } = req.body;

    const todayStr = new Date().toISOString().split('T')[0];
    if (date < todayStr) {
      return res.status(400).json({
        success: false,
        error: { code: "PAST_DATE_NOT_ALLOWED", message: "لا يمكن حجز موعد في تاريخ قد مضى" }
      });
    }

    const targetDoctorId = doctor_id || "doc-1";
    const service = await db.get(`SELECT * FROM services WHERE id = ?`, [service_id]);
    const durationMin = service ? service.duration_minutes : 20;

    const [h, m] = time.split(':').map(Number);
    const endDate = new Date(2026, 0, 1, h, m + durationMin);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const id = `apt-${Math.random().toString(36).substring(7)}`;
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || req.body.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const amount = service ? (payment_method === 'online' ? Math.round(service.price * 0.9) : service.price) : 500;
    const bookingCode = `BK-${Math.floor(Math.random() * 9000 + 1000)}`;
    const paymentStatus = payment_method === 'online' ? 'paid' : (visit_type === 'followup' ? 'free' : 'pending');
    const newStart = getMinutes(time);
    const newEnd = newStart + durationMin;

    // The conflict check + insert must be atomic — two concurrent requests
    // for the same doctor/date/time could otherwise both pass the check
    // before either inserts. BEGIN IMMEDIATE takes SQLite's write lock right
    // away, so a second request's own BEGIN IMMEDIATE blocks (up to the
    // configured busy timeout) until this transaction commits or rolls back.
    let newApt;
    try {
      await db.run('BEGIN IMMEDIATE');

      const existing = await db.all(
        `SELECT * FROM appointments WHERE date = ? AND doctor_id = ? AND status != 'cancelled'`,
        [date, targetDoctorId]
      );

      const hasConflict = existing.some(a => {
        const start = getMinutes(a.time);
        const end = getMinutes(a.end_time || a.time);
        return newStart < end && start < newEnd;
      });

      if (hasConflict) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: "APPOINTMENT_CONFLICT", message: "هذا الوقت يتعارض مع موعد محجوز بالفعل لهذا الطبيب" }
        });
      }

      const maxQueueRow = await db.get(`SELECT MAX(queue_number) as max_q FROM appointments WHERE date = ?`, [date]);
      const queueNumber = (maxQueueRow?.max_q || 0) + 1;

      await db.run(`
        INSERT INTO appointments (id, tenant_id, patient_id, doctor_id, service_id, date, time, end_time, status, visit_type, payment_method, payment_status, amount, queue_number, notes, booking_code, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, tenantId, patient_id, targetDoctorId, service_id || 'svc-001', date, time, endTime, visit_type || 'exam', payment_method || 'cash', paymentStatus, amount, queueNumber, notes || '', bookingCode, location || '']);

      newApt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [id]);
      await db.run('COMMIT');
    } catch (txErr) {
      await db.run('ROLLBACK').catch(() => {});
      throw txErr;
    }

    const patientObj = await db.get(`SELECT * FROM patients WHERE id = ?`, [patient_id]);
    const doctorObj = await db.get(`SELECT * FROM doctors WHERE id = ?`, [targetDoctorId]) || await db.get(`SELECT * FROM users WHERE tenant_id = ? AND role = 'owner'`, [tenantId]);
    const tenantObj = await db.get(`SELECT * FROM tenants WHERE id = ?`, [tenantId]);

    // Send notifications asynchronously (non-blocking)
    if (patientObj) {
      emailService.notifyPatientBookingConfirmed({
        patient: patientObj,
        appointment: newApt,
        service,
        doctor: doctorObj,
        clinic: tenantObj
      }).catch(e => console.error('Patient email error:', e));

      emailService.notifyDoctorNewBooking({
        doctor: doctorObj,
        patient: patientObj,
        appointment: newApt,
        service,
        clinic: tenantObj
      }).catch(e => console.error('Doctor email error:', e));

      notificationService.createNotification({
        tenantId,
        title: `حجز موعد جديد: ${patientObj.full_name}`,
        message: `تم حجز موعد جديد يوم ${newApt.date} الساعة ${newApt.time} (كود: ${bookingCode})`,
        type: 'booking',
        link: '/calendar.html'
      }).catch(e => console.error('In-app notification error:', e));
    }

    return res.status(201).json({ success: true, data: newApt });

  } catch (err) {
    console.error('Failed to create appointment:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء حجز الموعد' } });
  }
});

// --- Update Appointment ---
router.put('/v1/appointments/:id', async (req, res) => {
  try {
    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.id]);
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
    }

    const { date, time, status, notes, location, payment_status } = req.body;
    let endTime = apt.end_time;

    if (time) {
      const service = await db.get(`SELECT * FROM services WHERE id = ?`, [apt.service_id]);
      const durationMin = service ? service.duration_minutes : 20;
      const [h, m] = time.split(':').map(Number);
      const endDate = new Date(2026, 0, 1, h, m + durationMin);
      endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    }

    await db.run(`
      UPDATE appointments SET
        date = COALESCE(?, date),
        time = COALESCE(?, time),
        end_time = COALESCE(?, end_time),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        location = COALESCE(?, location),
        payment_status = COALESCE(?, payment_status)
      WHERE id = ?
    `, [date, time, endTime, status, notes, location, payment_status, req.params.id]);

    const updated = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.id]);
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء تحديث الموعد' } });
  }
});

// --- Update Appointment Status ---
router.put('/v1/appointments/:id/status', async (req, res) => {
  try {
    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.id]);
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
    }

    const { status, is_urgent } = req.body;
    let paymentStatus = apt.payment_status;

    if (status === 'completed' && apt.payment_method === 'cash') {
      paymentStatus = 'paid';
    }

    await db.run(`UPDATE appointments SET status = ?, payment_status = ? WHERE id = ?`, [status, paymentStatus, apt.id]);

    // Queue updates
    if (status === 'completed' || status === 'cancelled') {
      if (queueState.current_in_exam && queueState.current_in_exam.appointment_id === apt.id) {
        queueState.current_in_exam = null;
      }
      queueState.waiting_list = queueState.waiting_list.filter(item => item.appointment_id !== apt.id);
    }

    if (status === 'checked_in') {
      const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [apt.patient_id]);
      const alreadyInQueue = queueState.waiting_list.some(item => item.appointment_id === apt.id);

      if (!alreadyInQueue) {
        const waitingItem = {
          queue_number: apt.queue_number,
          patient_name: patient ? patient.full_name : 'مريض جديد',
          appointment_id: apt.id,
          is_urgent: !!is_urgent
        };

        if (is_urgent) {
          const lastUrgentIdx = queueState.waiting_list.map(i => i.is_urgent).lastIndexOf(true);
          queueState.waiting_list.splice(lastUrgentIdx + 1, 0, waitingItem);
        } else {
          queueState.waiting_list.push(waitingItem);
        }
      }
    }

    const updated = await db.get(`SELECT * FROM appointments WHERE id = ?`, [apt.id]);
    const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [apt.patient_id]);
    const tenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [apt.tenant_id]);

    // Send notifications if cancelled
    if (status === 'cancelled' && patient) {
      emailService.notifyPatientBookingCancelled({
        patient,
        appointment: apt,
        clinic: tenant,
        reason: req.body.reason || 'إلغاء عبر لوحة التحكم'
      }).catch(e => console.error('Cancel email error:', e));

      notificationService.createNotification({
        tenantId: apt.tenant_id,
        title: `إلغاء موعد: ${patient.full_name}`,
        message: `تم إلغاء الموعد المحدد يوم ${apt.date} (${apt.booking_code})`,
        type: 'warning',
        link: '/calendar.html'
      }).catch(e => console.error('In-app notification error:', e));
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء تغيير حالة الموعد' } });
  }
});

// --- Cancel Appointment ---
router.delete('/v1/appointments/:id', async (req, res) => {
  try {
    await db.run(`UPDATE appointments SET status = 'cancelled' WHERE id = ?`, [req.params.id]);
    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [req.params.id]);

    if (queueState.current_in_exam && queueState.current_in_exam.appointment_id === req.params.id) {
      queueState.current_in_exam = null;
    }
    queueState.waiting_list = queueState.waiting_list.filter(item => item.appointment_id !== req.params.id);

    if (apt) {
      const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [apt.patient_id]);
      const tenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [apt.tenant_id]);
      if (patient) {
        emailService.notifyPatientBookingCancelled({
          patient,
          appointment: apt,
          clinic: tenant,
          reason: 'إلغاء الحجز'
        }).catch(e => console.error('Cancel email error:', e));

        notificationService.createNotification({
          tenantId: apt.tenant_id,
          title: `تم حذف/إلغاء موعد: ${patient.full_name}`,
          message: `تم إلغاء موعد ${apt.date} (${apt.booking_code})`,
          type: 'warning'
        }).catch(e => console.error('In-app notif error:', e));
      }
    }

    return res.json({ success: true, data: apt });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء إلغاء الموعد' } });
  }
});

// --- Complete Consultation (Save medical record) ---
router.post('/v1/appointments/:appointment_id/consultation', async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const consultData = req.body;

    const apt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [appointment_id]);
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
    }

    await db.run(`UPDATE appointments SET status = 'completed', payment_status = 'paid' WHERE id = ?`, [appointment_id]);

    if (queueState.current_in_exam && queueState.current_in_exam.appointment_id === appointment_id) {
      queueState.current_in_exam = null;
    }
    queueState.waiting_list = queueState.waiting_list.filter(item => item.appointment_id !== appointment_id);

    const recordId = `rec-${Date.now()}`;
    const tenantId = apt.tenant_id;
    const prescriptionItems = JSON.stringify(consultData.prescription_items || []);
    const objective = JSON.stringify(consultData.objective || {});
    const dentalRecords = JSON.stringify(consultData.dental_records || {});

    const encSubjective = encrypt(consultData.subjective || "كشف سريري");
    const encDiagnosis = encrypt(consultData.diagnosis_icd11 || "عام");
    const encPlan = encrypt(consultData.plan || "");

    await db.run(`
      INSERT INTO medical_records (id, tenant_id, patient_id, appointment_id, doctor_id, subjective, objective, diagnosis_icd11, plan, prescription_items, dental_records)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [recordId, tenantId, apt.patient_id, appointment_id, apt.doctor_id || "doc-1", encSubjective, objective, encDiagnosis, encPlan, prescriptionItems, dentalRecords]);

    const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [apt.patient_id]);
    const tenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [tenantId]);

    // Send Consultation Complete Email & In-App Notification
    if (patient) {
      emailService.notifyPatientConsultationComplete({
        patient,
        appointment: apt,
        medicalRecord: { id: recordId, ...consultData },
        clinic: tenant
      }).catch(e => console.error('Consultation complete email error:', e));

      notificationService.createNotification({
        tenantId,
        title: `اكتمل الكشف الطبي: ${patient.full_name}`,
        message: `تم توثيق الكشف وحفظ الروشتة للمريض بنجاح (كود: ${apt.booking_code})`,
        type: 'success',
        link: `/v1/prescriptions/${recordId}/pdf`
      }).catch(e => console.error('In-app notif error:', e));
    }

    return res.status(200).json({
      success: true,
      data: {
        medical_record_id: recordId,
        prescription_id: `rx-${Date.now()}`,
        pdf_url: `/v1/prescriptions/${recordId}/pdf`,
        whatsapp_status: "enqueued"
      }
    });
  } catch (err) {
    console.error('Failed to save consultation:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء حفظ الزيارة في قاعدة البيانات' } });
  }
});

module.exports = router;
