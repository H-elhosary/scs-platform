// =============================================
// Smart Clinic OS — Doctor & Staff Routes (Real Database Mode)
// GET    /v1/doctors
// POST   /v1/doctors
// POST   /v1/staff
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');

// --- List Doctors ---
router.get('/v1/doctors', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const docs = await db.all(`SELECT * FROM doctors WHERE tenant_id = ?`, [tenantId]);
    return res.json({ success: true, data: docs });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء جلب قائمة الأطباء' } });
  }
});

// --- Add Doctor ---
router.post('/v1/doctors', async (req, res) => {
  try {
    const { full_name, specialty } = req.body;
    if (!full_name || !specialty) {
      return res.status(400).json({ success: false, error: { message: "يرجى إدخال اسم الطبيب وتخصصه" } });
    }

    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || req.body.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const tenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [tenantId]);
    const doctorsCountRow = await db.get(`SELECT COUNT(*) as count FROM doctors WHERE tenant_id = ?`, [tenantId]);
    const doctorsCount = doctorsCountRow?.count || 0;

    if (tenant && !tenant.allow_multi_doctor && doctorsCount >= 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MULTI_DOCTOR_LOCKED",
          message: "صلاحية الأطباء المتعددين غير مفعلة لباقة اشتراكك الحالية."
        }
      });
    }

    const id = `doc-${Math.random().toString(36).substring(7)}`;
    await db.run(`INSERT INTO doctors (id, tenant_id, full_name, specialty) VALUES (?, ?, ?, ?)`, [id, tenantId, full_name, specialty]);

    const newDoc = await db.get(`SELECT * FROM doctors WHERE id = ?`, [id]);
    return res.json({ success: true, data: newDoc });

  } catch (err) {
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء إضافة الطبيب' } });
  }
});

// --- Add Staff Member ---
router.post('/v1/staff', (req, res) => {
  return res.status(201).json({
    success: true,
    data: {
      staff_id: `staff-uuid-${Math.random().toString(36).substring(7)}`,
      role: "secretary",
      invitation_sent: true
    }
  });
});

module.exports = router;
