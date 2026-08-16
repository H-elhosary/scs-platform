// =============================================
// Smart Clinic OS — Conversation/Inbox Routes
// GET    /v1/inbox/conversations
// POST   /v1/inbox/conversations/:id/read
// POST   /v1/inbox/conversations/:id/messages
// POST   /v1/inbox/conversations/:id/bot
// POST   /v1/chats/:conversation_id/toggle-bot
// =============================================

const express = require('express');
const router = express.Router();
const data = require('../../data');

// Helper: normalize messages to include both body and text
const normalizeMessages = (messages) =>
  messages.map(m => ({ ...m, body: m.body || m.text }));

// --- List Conversations ---
router.get('/v1/inbox/conversations', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id;
  let list = data.mockConversations;
  if (tenantId) {
    const tenantConvs = list.filter(c => c.tenant_id === tenantId);
    if (tenantConvs.length > 0) list = tenantConvs;
  }
  const mapped = list.map(c => ({
    ...c,
    messages: normalizeMessages(c.messages)
  }));
  return res.json({ success: true, data: mapped });
});

// --- Mark Conversation as Read ---
router.post('/v1/inbox/conversations/:id/read', (req, res) => {
  const conv = data.mockConversations.find(c => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } });
  }
  conv.unread_count = 0;
  return res.json({
    success: true,
    data: { ...conv, messages: normalizeMessages(conv.messages) }
  });
});

// --- Send Message in Conversation ---
router.post('/v1/inbox/conversations/:id/messages', (req, res) => {
  const conv = data.mockConversations.find(c => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } });
  }

  const { body } = req.body;
  const newMsg = {
    id: `msg-${Math.random().toString(36).substring(7)}`,
    sender: "secretary",
    body,
    text: body,
    timestamp: new Date().toISOString()
  };

  conv.messages.push(newMsg);
  conv.last_message = body;
  conv.last_message_at = newMsg.timestamp;
  conv.bot_active = false;
  conv.status = 'manual_mode';

  return res.json({
    success: true,
    data: { ...conv, messages: normalizeMessages(conv.messages) }
  });
});

// --- Toggle Bot Mode ---
router.post('/v1/inbox/conversations/:id/bot', (req, res) => {
  const conv = data.mockConversations.find(c => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } });
  }
  conv.bot_active = !!req.body.active;
  conv.status = req.body.active ? 'active' : 'manual_mode';
  return res.json({
    success: true,
    data: { bot_active: conv.bot_active, status: conv.status }
  });
});

// --- Legacy Toggle Bot ---
router.post('/v1/chats/:conversation_id/toggle-bot', (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      conversation_id: req.params.conversation_id,
      bot_active: !req.body.manual_mode
    }
  });
});

module.exports = router;
