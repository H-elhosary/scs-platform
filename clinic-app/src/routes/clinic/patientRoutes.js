// =============================================
// Smart Clinic OS — Patient Routes (Real Database Mode)
// GET    /v1/patients
// GET    /v1/patients/:id
// POST   /v1/patients
// PUT    /v1/patients/:id
// GET    /v1/patients/:id/medical-records
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');

// --- List Patients (with search, tag filter, pagination) ---
router.get('/v1/patients', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const { search, tag, page = 1, limit = 20 } = req.query;
    let sql = `SELECT * FROM patients WHERE tenant_id = ?`;
    const params = [tenantId];

    if (search) {
      sql += ` AND (LOWER(full_name) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?)`;
      const s = `%${search.toLowerCase()}%`;
      params.push(s, `%${search}%`, s);
    }
    if (tag) {
      sql += ` AND tags LIKE ?`;
      params.push(`%${tag}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const allRows = await db.all(sql, params);
    const total = allRows.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = allRows.slice(start, start + parseInt(limit));

    // Normalize tags
    const patients = paginated.map(p => ({
      ...p,
      tags: typeof p.tags === 'string' ? p.tags.split(',').filter(Boolean) : (p.tags || [])
    }));

    return res.json({
      success: true,
      data: {
        patients,
        total,
        page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Failed to get patients:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ في قاعدة البيانات' } });
  }
});

// --- Get Single Patient with appointments and records ---
router.get('/v1/patients/:id', async (req, res) => {
  try {
    const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [req.params.id]);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: { code: "PATIENT_NOT_FOUND", message: "المريض غير موجود" }
      });
    }

    patient.tags = typeof patient.tags === 'string' ? patient.tags.split(',').filter(Boolean) : (patient.tags || []);

    const appointments = await db.all(`
      SELECT a.*, s.name as service_name
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.patient_id = ?
      ORDER BY a.date DESC, a.time DESC
    `, [patient.id]);

    const records = await db.all(`
      SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC
    `, [patient.id]);

    return res.json({
      success: true,
      data: { patient, appointments, medical_records: records }
    });
  } catch (err) {
    console.error('Failed to get patient profile:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ في قاعدة البيانات' } });
  }
});

// --- Create Patient ---
router.post('/v1/patients', async (req, res) => {
  try {
    const { full_name, phone, age, gender, email } = req.body;
    if (!full_name || !phone) {
      return res.status(400).json({ success: false, error: { message: 'اسم المريض ورقم الهاتف مطلوبة' } });
    }

    const names = full_name.split(' ');
    const id = `pat-${Math.random().toString(36).substring(7)}`;
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || req.body.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const firstName = names[0] || full_name;
    const lastName = names.length > 1 ? names[names.length - 1] : '';
    const now = new Date().toISOString();

    await db.run(`
      INSERT INTO patients (id, tenant_id, phone, full_name, first_name, last_name, age, gender, email, source, tags, total_visits, total_paid, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', '', 0, 0, ?)
    `, [id, tenantId, phone, full_name, firstName, lastName, age ? parseInt(age) : null, gender || null, email || null, now]);

    const newPatient = await db.get(`SELECT * FROM patients WHERE id = ?`, [id]);
    newPatient.tags = [];

    return res.status(201).json({ success: true, data: newPatient });
  } catch (err) {
    console.error('Failed to create patient:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء إضافة المريض في قاعدة البيانات' } });
  }
});

// --- Update Patient ---
router.put('/v1/patients/:id', async (req, res) => {
  try {
    const patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [req.params.id]);
    if (!patient) {
      return res.status(404).json({ success: false, error: { code: "PATIENT_NOT_FOUND", message: "المريض غير موجود" } });
    }

    const { full_name, phone, age, gender, email, blood_type, allergies, chronic_conditions, tags } = req.body;

    await db.run(`
      UPDATE patients SET
        full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        age = COALESCE(?, age),
        gender = COALESCE(?, gender),
        email = COALESCE(?, email),
        blood_type = COALESCE(?, blood_type),
        allergies = COALESCE(?, allergies),
        chronic_conditions = COALESCE(?, chronic_conditions),
        tags = COALESCE(?, tags)
      WHERE id = ?
    `, [full_name, phone, age, gender, email, blood_type, allergies, chronic_conditions, Array.isArray(tags) ? tags.join(',') : tags, req.params.id]);

    const updated = await db.get(`SELECT * FROM patients WHERE id = ?`, [req.params.id]);
    updated.tags = typeof updated.tags === 'string' ? updated.tags.split(',').filter(Boolean) : (updated.tags || []);

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Failed to update patient:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء تحديث المريض' } });
  }
});

// --- Patient Medical Records ---
router.get('/v1/patients/:id/medical-records', async (req, res) => {
  try {
    const records = await db.all(`SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC`, [req.params.id]);
    return res.json({ success: true, data: records });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء جلب السجلات' } });
  }
});

module.exports = router;
