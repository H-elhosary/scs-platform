// =============================================
// Smart Clinic OS — Settings Routes
// All /v1/settings/* endpoints
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');
const data = require('../../data');
const settings = require('../../data/mockSettings');

// =============================================
// Services CRUD
// =============================================

router.get('/v1/settings/services', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const services = await db.all(`SELECT * FROM services WHERE tenant_id = ?`, [tenantId]);
    return res.json({ success: true, data: services });
  } catch (err) {
    return res.json({ success: true, data: data.mockServices });
  }
});

router.post('/v1/settings/services', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || req.body.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const { name, name_en, price, duration_minutes, category } = req.body;
  const id = `svc-${Math.random().toString(36).substring(7)}`;
  try {
    await db.run(`
      INSERT INTO services (id, tenant_id, name, name_en, price, duration_minutes, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, tenantId, name, name_en || '', parseFloat(price) || 0, parseInt(duration_minutes) || 20, category || 'exam']);
    const newService = await db.get(`SELECT * FROM services WHERE id = ?`, [id]);
    return res.status(201).json({ success: true, data: newService });
  } catch(e) {
    const newService = { id, tenant_id: tenantId, name, name_en: name_en || '', price: parseFloat(price) || 0, duration_minutes: parseInt(duration_minutes) || 20, category: category || 'exam', is_active: true };
    return res.status(201).json({ success: true, data: newService });
  }
});

router.put('/v1/settings/services/:id', (req, res) => {
  const svc = data.mockServices.find(s => s.id === req.params.id);
  if (!svc) {
    return res.status(404).json({ success: false, error: { message: "الخدمة غير موجودة" } });
  }
  Object.assign(svc, req.body);
  return res.json({ success: true, data: svc });
});

// =============================================
// Working Hours
// =============================================

// Working Hours memory cache per doctor
const doctorWorkingHoursStore = {};

router.get('/v1/settings/working-hours', (req, res) => {
  const { doctor_id } = req.query;

  if (doctor_id) {
    if (!doctorWorkingHoursStore[doctor_id]) {
      let customHours = JSON.parse(JSON.stringify(data.mockWorkingHours));
      if (doctor_id !== "doc-uuid-noor-1" && doctor_id !== "doc-1") {
        customHours.forEach(h => {
          if (h.day === 'tuesday' || h.day === 'thursday') {
            h.is_open = false;
            h.shifts = [];
          }
        });
      }
      doctorWorkingHoursStore[doctor_id] = customHours;
    }
    return res.json({ success: true, data: doctorWorkingHoursStore[doctor_id] });
  }

  return res.json({ success: true, data: data.mockWorkingHours });
});

router.put('/v1/settings/working-hours', (req, res) => {
  const { doctor_id } = req.query;
  const { working_hours } = req.body;

  if (doctor_id) {
    if (working_hours && Array.isArray(working_hours)) {
      doctorWorkingHoursStore[doctor_id] = working_hours;
    }
    return res.json({ success: true, data: doctorWorkingHoursStore[doctor_id] || data.mockWorkingHours });
  }

  if (working_hours && Array.isArray(working_hours)) {
    working_hours.forEach(wh => {
      const existing = data.mockWorkingHours.find(h => h.day === wh.day);
      if (existing) Object.assign(existing, wh);
    });
  }

  return res.json({ success: true, data: data.mockWorkingHours });
});

// =============================================
// Notification Settings
// =============================================

router.get('/v1/settings/notifications', (req, res) => {
  return res.json({ success: true, data: { notification_settings: settings.getNotificationSettings() } });
});

router.put('/v1/settings/notifications', (req, res) => {
  if (req.body.notification_settings) {
    const current = settings.getNotificationSettings();
    settings.setNotificationSettings({ ...current, ...req.body.notification_settings });
  }
  return res.json({
    success: true,
    data: { message: "تم تحديث إعدادات الإشعارات بنجاح", updated_settings: settings.getNotificationSettings() }
  });
});

// =============================================
// Operational Settings
// =============================================

router.get('/v1/settings/operational', (req, res) => {
  return res.json({ success: true, data: settings.getOperationalSettings() });
});

router.put('/v1/settings/operational', (req, res) => {
  const current = settings.getOperationalSettings();
  settings.setOperationalSettings({ ...current, ...req.body });
  return res.json({ success: true, data: settings.getOperationalSettings() });
});

// =============================================
// Prescription Settings
// =============================================

router.get('/v1/settings/prescription', (req, res) => {
  return res.json({ success: true, data: settings.getPrescriptionSettings() });
});

router.put('/v1/settings/prescription', (req, res) => {
  const current = settings.getPrescriptionSettings();
  settings.setPrescriptionSettings({ ...current, ...req.body });
  return res.json({ success: true, data: settings.getPrescriptionSettings() });
});

// =============================================
// Refund Settings
// =============================================

router.get('/v1/settings/refund', (req, res) => {
  return res.json({ success: true, data: settings.getRefundSettings() });
});

router.put('/v1/settings/refund', (req, res) => {
  const current = settings.getRefundSettings();
  settings.setRefundSettings({ ...current, ...req.body });
  return res.json({ success: true, data: settings.getRefundSettings() });
});

// =============================================
// Insurance Companies
// =============================================

router.get('/v1/settings/insurance', (req, res) => {
  return res.json({ success: true, data: settings.getInsuranceCompanies() });
});

router.post('/v1/settings/insurance', (req, res) => {
  const { name_ar, name_en, coverage } = req.body;
  if (!name_ar || !name_en) {
    return res.status(400).json({ success: false, error: { message: "الاسم مطلوب" } });
  }
  const nc = {
    id: `ins-${Math.random().toString(36).substring(7)}`,
    name_ar,
    name_en,
    active: true,
    coverage: parseInt(coverage) || 80
  };
  settings.getInsuranceCompanies().push(nc);
  return res.json({ success: true, data: nc });
});

router.put('/v1/settings/insurance/:id', (req, res) => {
  const c = settings.getInsuranceCompanies().find(c => c.id === req.params.id);
  if (!c) {
    return res.status(404).json({ success: false, error: { message: "شركة التأمين غير موجودة" } });
  }
  if (req.body.active !== undefined) c.active = req.body.active;
  if (req.body.coverage !== undefined) c.coverage = parseInt(req.body.coverage);
  return res.json({ success: true, data: c });
});

// =============================================
// Channel Settings (WhatsApp & Telegram)
// =============================================

let telegramPollInterval = null;
let lastUpdateId = 0;

function startTelegramPolling(botToken) {
  if (telegramPollInterval) {
    clearInterval(telegramPollInterval);
  }
  console.log(`📡 [Telegram Polling] Starting background updates poll loop...`);

  // Delete webhook to ensure Telegram sends updates via getUpdates
  fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`)
    .then(r => r.json())
    .catch(e => {});

  telegramPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`)
        .then(r => r.json());

      if (res.ok && res.result && res.result.length > 0) {
        const botController = require('../../services/botController');
        for (const update of res.result) {
          lastUpdateId = update.update_id;
          const message = update.message;
          if (message) {
            const chatId = message.chat.id.toString();
            const text = message.text || '';
            const firstName = message.from ? message.from.first_name : 'مريض';
            const tenantId = "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

            console.log(`\n💬 [Telegram Polling Received] From Chat ID: ${chatId} (${firstName}): "${text}"`);

            const botResponse = await botController.handleIncomingMessage(tenantId, 'telegram', chatId, text, firstName);
            console.log(`📱 [Telegram Polling Outgoing Reply] To Chat ID: ${chatId} -> "${botResponse.reply}"`);

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: botResponse.reply })
            }).then(r => r.json());
          }
        }
      }
    } catch (err) {
      // Quietly ignore network failures
    }
  }, 2000);
}

function stopTelegramPolling() {
  if (telegramPollInterval) {
    clearInterval(telegramPollInterval);
    telegramPollInterval = null;
    console.log(`📡 [Telegram Polling] Stopped background updates poll loop.`);
  }
}

router.get('/v1/settings/channels', (req, res) => {
  return res.json({ success: true, data: settings.getChannelSettings() });
});

router.put('/v1/settings/channels/whatsapp', (req, res) => {
  const current = settings.getChannelSettings();
  current.whatsapp = {
    ...current.whatsapp,
    ...req.body,
    webhook_url: current.whatsapp.webhook_url,
    verify_token: current.whatsapp.verify_token
  };
  settings.setChannelSettings(current);
  return res.json({ success: true, data: current.whatsapp });
});

router.put('/v1/settings/channels/telegram', (req, res) => {
  const current = settings.getChannelSettings();
  current.telegram = {
    ...current.telegram,
    ...req.body,
    webhook_url: current.telegram.webhook_url
  };
  settings.setChannelSettings(current);

  if (current.telegram.enabled && current.telegram.bot_token) {
    startTelegramPolling(current.telegram.bot_token);
  } else {
    stopTelegramPolling();
  }

  return res.json({ success: true, data: current.telegram });
});

router.put('/v1/settings/channels/doctor', (req, res) => {
  const current = settings.getChannelSettings();
  current.bot_greeting = req.body.bot_greeting || current.bot_greeting;
  current.whatsapp.enabled = !!req.body.whatsapp_enabled;
  current.telegram.enabled = !!req.body.telegram_enabled;
  settings.setChannelSettings(current);

  if (current.telegram.enabled && current.telegram.bot_token) {
    startTelegramPolling(current.telegram.bot_token);
  } else {
    stopTelegramPolling();
  }

  return res.json({
    success: true,
    data: {
      bot_greeting: current.bot_greeting,
      whatsapp_enabled: current.whatsapp.enabled,
      telegram_enabled: current.telegram.enabled
    }
  });
});

router.post('/v1/settings/channels/whatsapp/test', (req, res) => {
  const current = settings.getChannelSettings();
  if (!current.whatsapp.phone_number_id || !current.whatsapp.access_token) {
    return res.status(400).json({ success: false, error: { message: 'يرجى إدخال بيانات واتساب أولاً' } });
  }
  current.whatsapp.status = 'connected';
  current.whatsapp.enabled = true;
  current.whatsapp.last_tested_at = new Date().toISOString();
  settings.setChannelSettings(current);
  return res.json({ success: true, data: { status: 'connected', message: '✅ تم الاتصال بنجاح!' } });
});

router.post('/v1/settings/channels/telegram/test', (req, res) => {
  const current = settings.getChannelSettings();
  if (!current.telegram.bot_token) {
    return res.status(400).json({ success: false, error: { message: 'يرجى إدخال Bot Token أولاً' } });
  }
  current.telegram.status = 'connected';
  current.telegram.enabled = true;
  current.telegram.last_tested_at = new Date().toISOString();
  settings.setChannelSettings(current);
  startTelegramPolling(current.telegram.bot_token);
  return res.json({ success: true, data: { status: 'connected', message: '✅ تم ربط وتفعيل بوت تليجرام بنجاح!' } });
});

module.exports = router;
