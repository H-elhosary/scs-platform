// =============================================
// Smart Clinic OS — Ticket Routes
// GET    /v1/tickets
// POST   /v1/tickets
// =============================================

const express = require('express');
const router = express.Router();
const data = require('../../data');

// --- List Tickets (for current tenant) ---
router.get('/v1/tickets', (req, res) => {
  const tenantId = 'tenant-uuid-noor';
  const tickets = data.mockTickets.filter(t => t.tenant_id === tenantId);
  return res.json({ success: true, data: tickets });
});

// --- Create Ticket ---
router.post('/v1/tickets', (req, res) => {
  const { type, title, description } = req.body;

  if (!type || !title || !description) {
    return res.status(400).json({
      success: false,
      error: { message: "يرجى تعبئة كافة الحقول المطلوبة" }
    });
  }

  const typeLabels = {
    renew: "تجديد اشتراك",
    upgrade: "ترقية الباقة",
    maintenance: "طلب صيانة",
    complaint: "شكوى أو اقتراح"
  };

  const newTicket = {
    id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
    tenant_id: 'tenant-uuid-noor',
    tenant_name: 'عيادة النور لطب الأسنان',
    type,
    type_ar: typeLabels[type] || type,
    title,
    description,
    status: "pending",
    created_at: new Date().toISOString(),
    response_notes: ""
  };

  data.mockTickets.push(newTicket);
  return res.status(201).json({ success: true, data: newTicket });
});

module.exports = router;
