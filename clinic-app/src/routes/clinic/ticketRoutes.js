// =============================================
// Smart Clinic OS — Ticket Routes
// GET    /v1/tickets
// POST   /v1/tickets
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const emailService = require('../../services/emailService');
const notificationService = require('../../services/notificationService');

const DEFAULT_TENANT_ID = 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

const typeLabels = {
  renew: "تجديد اشتراك",
  upgrade: "ترقية الباقة",
  maintenance: "طلب صيانة",
  complaint: "شكوى أو اقتراح"
};

// --- List Tickets (for current tenant) ---
router.get('/v1/tickets', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || DEFAULT_TENANT_ID;
    const tickets = await db.all(`SELECT * FROM tickets WHERE tenant_id = ? ORDER BY created_at DESC`, [tenantId]);
    return res.json({ success: true, data: tickets });
  } catch (err) {
    console.error('Failed to list tickets:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء جلب طلبات الدعم الفني' } });
  }
});

// --- Create Ticket ---
router.post('/v1/tickets', async (req, res) => {
  try {
    const { type, title, description } = req.body;

    if (!type || !title || !description) {
      return res.status(400).json({
        success: false,
        error: { message: "يرجى تعبئة كافة الحقول المطلوبة" }
      });
    }

    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || DEFAULT_TENANT_ID;
    const tenant = await db.get(`SELECT name FROM tenants WHERE id = ?`, [tenantId]);
    const id = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.run(`
      INSERT INTO tickets (id, tenant_id, tenant_name, type, type_ar, title, description, status, response_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '')
    `, [id, tenantId, tenant ? tenant.name : '', type, typeLabels[type] || type, title, description]);

    const newTicket = await db.get(`SELECT * FROM tickets WHERE id = ?`, [id]);

    // Send email alert to Ops team
    emailService.notifyOpsNewTicket({
      ticket: newTicket,
      clinic: tenant
    }).catch(e => console.error('Ops ticket email error:', e));

    // Create in-app notification
    notificationService.createNotification({
      tenantId,
      title: `تم إرسال طلب الدعم #${id}`,
      message: `تم إرسال طلبك ("${title}") بنجاح لفريق العمليات. سنرد عليك في أقرب وقت.`,
      type: 'info'
    }).catch(e => console.error('In-app notif error:', e));

    return res.status(201).json({ success: true, data: newTicket });
  } catch (err) {
    console.error('Failed to create ticket:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ أثناء إرسال الطلب' } });
  }
});

module.exports = router;
