const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db/connection');
const botController = require('../services/botController');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

// --- Webhook signature verification ---
// Each provider's secret is optional: if unset, the request is allowed
// through with a loud warning (dev/no-credentials-yet mode) rather than
// rejected outright, so the bot/payment flows keep working until real
// provider secrets are configured. Once a secret IS set, a mismatch is
// rejected and logged distinctly from "not configured".

function verifyWhatsappSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.warn('⚠️  [WhatsApp Webhook] WHATSAPP_APP_SECRET not configured — accepting request unverified.');
    return true;
  }
  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader || !req.rawBody) {
    console.error('❌ [WhatsApp Webhook] Missing signature header or raw body — rejecting.');
    return false;
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error('❌ [WhatsApp Webhook] Signature mismatch — rejecting.');
    return false;
  }
  return true;
}

function verifyTelegramSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('⚠️  [Telegram Webhook] TELEGRAM_WEBHOOK_SECRET not configured — accepting request unverified.');
    return true;
  }
  const header = req.headers['x-telegram-bot-api-secret-token'] || '';
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error('❌ [Telegram Webhook] Secret token mismatch — rejecting.');
    return false;
  }
  return true;
}

function verifyPaymobHmac(req) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) {
    console.warn('⚠️  [Paymob Webhook] PAYMOB_HMAC_SECRET not configured — accepting request unverified.');
    return true;
  }
  const receivedHmac = req.query.hmac || req.body.hmac;
  const obj = req.body.obj;
  if (!receivedHmac || !obj) {
    console.error('❌ [Paymob Webhook] Missing hmac or obj in payload — rejecting.');
    return false;
  }
  // Field order per Paymob's "Transaction Processed Callback" HMAC spec.
  // Written from the standard documented order — cross-check against the
  // live Paymob merchant dashboard docs once real credentials exist; a
  // wrong order here would otherwise fail silently forever.
  const fields = [
    obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
    obj.has_parent_transaction, obj.id, obj.integration_id, obj.is_3d_secure,
    obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
    obj.is_voided, obj.order?.id, obj.owner, obj.pending,
    obj.source_data?.pan, obj.source_data?.sub_type, obj.source_data?.type,
    obj.success
  ].map(v => (v === undefined || v === null) ? '' : String(v)).join('');

  const expected = crypto.createHmac('sha512', secret).update(fields).digest('hex');
  const a = Buffer.from(String(receivedHmac));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error('❌ [Paymob Webhook] HMAC mismatch — rejecting. If this persists after configuring PAYMOB_HMAC_SECRET, the field order likely needs adjusting per Paymob\'s live docs.');
    return false;
  }
  return true;
}

// The debug/test endpoints below (paymob/simulate, bot-state, reset-state,
// seed-visit) let anyone inspect or mutate any patient's conversation/
// booking/payment state with no auth check — they exist only so the bot.js
// simulator tool can drive test flows. Hard-disable them outside development
// so they can never be reached in a real deployment.
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "غير متاح" } });
  }
  next();
};

// Mask a phone number / chat id for logging — keep enough to correlate log
// lines during debugging without printing the full identifier.
const maskId = (id) => {
  const s = String(id || '');
  return s.length > 4 ? `***${s.slice(-4)}` : '***';
};

/**
 * 1. WhatsApp Webhook Verification (Meta API)
 */
router.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[WhatsApp Webhook Verification] Mode: ${mode}, Token: ${token}`);

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'my_secret_token';
  if (mode === 'subscribe' && token === verifyToken) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

/**
 * 2. WhatsApp Message Webhook Receiver
 */
router.post('/webhooks/whatsapp', async (req, res) => {
  try {
    if (!verifyWhatsappSignature(req)) {
      return res.status(403).json({ success: false, error: { code: "INVALID_SIGNATURE", message: "توقيع الطلب غير صالح" } });
    }
    const body = req.body;
    console.log(`[WhatsApp Webhook Received]`);

    // Extract message details
    const entry = body.entry && body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const message = value && value.messages && value.messages[0];
    const contact = value && value.contacts && value.contacts[0];

    if (message) {
      const fromNumber = message.from;
      const text = message.text ? message.text.body : '';
      const name = contact && contact.profile ? contact.profile.name : 'مريض';

      // Default to Mohmamed Noor clinic ID for simulation
      const tenantId = "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

      console.log(`\n💬 [WhatsApp Received] From: ${maskId(fromNumber)} — message length: ${text.length}`);

      // Handle message
      const botResponse = await botController.handleIncomingMessage(tenantId, 'whatsapp', fromNumber, text, name);

      // Print simulated outgoing reply (reply content withheld from logs — may echo patient details)
      console.log(`\n==========================================`);
      console.log(`📱 [WhatsApp Outgoing Reply] To: ${maskId(fromNumber)}`);
      console.log(`==========================================\n`);

      return res.status(200).json({
        success: true,
        status: 'received',
        reply: botResponse.reply
      });
    }

    return res.status(200).json({ success: true, status: 'no_message' });
  } catch (error) {
    console.error('Error in WhatsApp webhook handler:', error);
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ غير متوقع في الخادم" } });
  }
});

/**
 * 3. Telegram Message Webhook Receiver
 */
router.post('/webhooks/telegram', async (req, res) => {
  try {
    if (!verifyTelegramSecret(req)) {
      return res.status(403).json({ success: false, error: { code: "INVALID_SIGNATURE", message: "توقيع الطلب غير صالح" } });
    }
    const body = req.body;
    console.log(`[Telegram Webhook Received]`);

    const message = body.message;
    if (message) {
      const chatId = message.chat.id.toString();
      const text = message.text || '';
      const firstName = message.from ? message.from.first_name : 'مريض';

      const tenantId = "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

      console.log(`\n💬 [Telegram Received] From Chat ID: ${maskId(chatId)} — message length: ${text.length}`);

      const botResponse = await botController.handleIncomingMessage(tenantId, 'telegram', chatId, text, firstName);

      console.log(`\n==========================================`);
      console.log(`📱 [Telegram Outgoing Reply] To Chat ID: ${maskId(chatId)}`);
      console.log(`==========================================\n`);

      return res.status(200).json({
        method: "sendMessage",
        chat_id: chatId,
        text: botResponse.reply
      });
    }

    return res.status(200).json({ success: true, status: 'no_message' });
  } catch (error) {
    console.error('Error in Telegram webhook handler:', error);
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ غير متوقع في الخادم" } });
  }
});

/**
 * 4. Paymob Callback Webhook handler
 */
router.post('/webhooks/payments/paymob', async (req, res) => {
  try {
    if (!verifyPaymobHmac(req)) {
      return res.status(403).json({ success: false, error: { code: "INVALID_SIGNATURE", message: "توقيع الطلب غير صالح" } });
    }
    const { obj } = req.body;
    console.log(`[Paymob Webhook Transaction Callback] Received`, JSON.stringify(req.body, null, 2));

    if (obj && obj.success) {
      const amount = obj.amount_cents / 100;
      const order = obj.order;
      const invoiceId = order ? order.merchant_order_id : null;
      
      const extra = obj.payment_key_claims ? obj.payment_key_claims.extra : null;
      const tenantId = extra ? extra.tenant_id : null;
      const appointmentId = extra ? extra.appointment_id : null;

      console.log(`💳 [Paymob Success] Invoice ID: ${invoiceId}, Appointment ID: ${appointmentId}, Amount: ${amount} EGP`);

      // Confirm appointment & Mark invoice Paid
      let appt = null;
      let patient = null;
      let tenant = null;

      if (db.isMock) {
        appt = db.memoryDB.appointments.find(a => a.id === appointmentId);
        if (appt) {
          appt.status = 'confirmed';
          appt.payment_status = 'paid';
          patient = db.memoryDB.patients.find(p => p.id === appt.patient_id);
          tenant = db.memoryDB.tenants.find(t => t.id === appt.tenant_id);
        }

        const inv = db.memoryDB.invoices ? db.memoryDB.invoices.find(i => i.id === invoiceId) : null;
        if (inv) inv.status = 'paid';
      } else {
        await db.run(`UPDATE appointments SET status = 'confirmed', payment_status = 'paid' WHERE id = ?`, [appointmentId]);
        appt = await db.get(`SELECT * FROM appointments WHERE id = ?`, [appointmentId]);
        if (appt) {
          patient = await db.get(`SELECT * FROM patients WHERE id = ?`, [appt.patient_id]);
          tenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [appt.tenant_id]);
        }
      }

      // Send Payment Receipt Email & Notification
      if (appt && tenant) {
        emailService.notifyPaymentReceipt({
          patient,
          amount,
          appointmentId,
          invoiceId,
          clinic: tenant
        }).catch(e => console.error('Payment email error:', e));

        notificationService.createNotification({
          tenantId: appt.tenant_id,
          title: `تم سداد إلكتروني بنجاح: ${amount} ج.م`,
          message: `تم تحصيل مبلغ ${amount} ج.م عبر Paymob للموعد #${appointmentId} (${patient?.full_name || 'مريض'})`,
          type: 'success',
          link: '/calendar.html'
        }).catch(e => console.error('In-app notif error:', e));
      }

      console.log(`\n==========================================`);
      console.log(`🔔 [Booking Confirmed via Paymob Webhook]`);
      console.log(`🏥 Clinic/Tenant ID: ${tenantId}`);
      console.log(`🗓️ Appointment ID: ${appointmentId}`);
      console.log(`💰 Paid amount: ${amount} EGP`);
      console.log(`==========================================\n`);

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: false, message: 'Transaction pending or failed' });
  } catch (error) {
    console.error('Error in Paymob webhook handler:', error);
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ غير متوقع في الخادم" } });
  }
});

/**
 * 5. Simulated Paymob Portal page (Interactive UI)
 */
router.get('/webhooks/payments/paymob/simulate', devOnly, (req, res) => {
  const { invoice_id, tenant_id, appointment_id } = req.query;

  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>بوابة سداد Paymob - محاكاة</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Cairo', 'Outfit', sans-serif;
          background: radial-gradient(circle at 10% 20%, rgb(18, 28, 48) 0%, rgb(9, 14, 25) 90.2%);
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .pay-card {
          background: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          max-width: 450px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .paymob-logo {
          color: #2563eb;
          font-size: 32px;
          font-weight: 900;
          margin-bottom: 24px;
        }
        h2 { margin-bottom: 12px; font-weight: 700; color: #fff; }
        p { color: #94a3b8; font-size: 14px; margin-bottom: 30px; line-height: 1.6; }
        .details-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 30px;
          text-align: right;
          font-size: 13px;
        }
        .details-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .details-row:last-child { margin-bottom: 0; font-weight: bold; color: #10b981; }
        .btn-pay {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: white;
          padding: 14px 28px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }
        .btn-pay:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.4);
        }
      </style>
    </head>
    <body>
      <div class="pay-card">
        <div class="paymob-logo">Paymob <span style="font-size: 14px; color: #94a3b8; font-weight: normal;">Simulator</span></div>
        <h2>بوابة الدفع الآمنة لمجموعتنا</h2>
        <p>يرجى النقر لتأكيد دفع فاتورة حجز موعد كشف العيادة الذكية.</p>
        
        <div class="details-box">
          <div class="details-row"><span>رقم الفاتورة:</span> <code>${invoice_id}</code></div>
          <div class="details-row"><span>رقم الحجز:</span> <code>${appointment_id}</code></div>
          <div class="details-row"><span>القيمة المطلوبة:</span> <span>180.00 جنيه مصري</span></div>
        </div>

        <button class="btn-pay" onclick="executePayment()">سداد القيمة الآن</button>
      </div>

      <script>
        async function executePayment() {
          const btn = document.querySelector('.btn-pay');
          btn.disabled = true;
          btn.innerText = "جاري معالجة الدفع...";

          try {
            const res = await fetch('/webhooks/payments/paymob', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                obj: {
                  success: true,
                  amount_cents: 18000,
                  order: {
                    merchant_order_id: '${invoice_id}'
                  },
                  payment_key_claims: {
                    extra: {
                      tenant_id: '${tenant_id}',
                      appointment_id: '${appointment_id}'
                    }
                  }
                }
              })
            });

            const data = await res.json();
            if (data.success) {
              document.body.innerHTML = \`
                <div class="pay-card" style="border-color: #10b981;">
                  <div style="font-size: 64px; color: #10b981; margin-bottom: 20px;">✓</div>
                  <h2>تم السداد بنجاح!</h2>
                  <p>تم تحصيل القيمة وتأكيد حجز الموعد الخاص بك. سيتم إشعار البوت لتأكيد العملية وتحديث الفاتورة فوراً.</p>
                  <p style="font-size: 12px; color: #94a3b8;">يمكنك إغلاق هذه الصفحة والعودة للدردشة الآن.</p>
                </div>
              \`;
            } else {
              alert("فشلت عملية السداد، يرجى المحاولة لاحقاً.");
              btn.disabled = false;
              btn.innerText = "سداد القيمة الآن";
            }
          } catch(e) {
            alert("حدث خطأ في الاتصال بالشبكة.");
            btn.disabled = false;
            btn.innerText = "سداد القيمة الآن";
          }
        }
      </script>
    </body>
    </html>
  `);
});

/**
 * 6. Debug Endpoint: Get Bot State
 */
router.get('/webhooks/payments/bot-state', devOnly, (req, res) => {
  const { phone } = req.query;
  const state = botController.conversationStates[phone] || { step: 'IDLE' };
  return res.status(200).json({ success: true, state: state.step });
});

/**
 * 7. Debug Endpoint: Reset Bot State
 */
router.post('/webhooks/payments/reset-state', devOnly, (req, res) => {
  const { phone } = req.body;
  if (phone) {
    delete botController.conversationStates[phone];
  }
  return res.status(200).json({ success: true });
});

/**
 * 8. Debug Endpoint: Seed Completed Visit for 14-days free followup check
 */
router.post('/webhooks/payments/seed-visit', devOnly, async (req, res) => {
  try {
    const { phone, tenant_id } = req.body;
    const phoneClean = phone.replace('+', '');
    
    // Check if patient exists, otherwise create
    let patient = null;
    if (db.isMock) {
      patient = db.memoryDB.patients.find(p => p.phone === phoneClean && p.tenant_id === tenant_id);
      if (!patient) {
        patient = {
          id: `pat-${Math.random().toString(36).substring(7)}`,
          tenant_id,
          name: "أحمد المريض التجريبي",
          age: 35,
          gender: "male",
          phone: phoneClean,
          created_at: new Date().toISOString()
        };
        db.memoryDB.patients.push(patient);
      }

      // Create a completed appointment dated yesterday
      const apptId = `appt-${Math.random().toString(36).substring(7)}`;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      db.memoryDB.appointments.push({
        id: apptId,
        tenant_id,
        doctor_id: "doc-1",
        doctor_name: "د. محمد نور",
        patient_id: patient.id,
        patient_name: patient.name,
        date: yesterday,
        time: "10:00",
        status: "completed",
        visit_type: "exam",
        price: 200,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      });
    } else {
      // Postgres Mode
      let patRes = await db.query(`SELECT * FROM patients WHERE phone = $1 AND tenant_id = $2`, [phoneClean, tenant_id]);
      let patientId;
      if (patRes.rows.length === 0) {
        const insPat = await db.query(
          `INSERT INTO patients (name, age, gender, phone, tenant_id) 
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          ["أحمد المريض التجريبي", 35, "male", phoneClean, tenant_id]
        );
        patientId = insPat.rows[0].id;
      } else {
        patientId = patRes.rows[0].id;
      }

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const apptId = `appt-${Math.random().toString(36).substring(7)}`;
      
      await db.query(
        `INSERT INTO appointments (id, tenant_id, doctor_id, patient_id, date, time, status, visit_type, price, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '1 day')`,
        [apptId, tenant_id, 'doc-1', patientId, yesterday, '10:00', 'completed', 'exam', 200]
      );
    }

    return res.status(200).json({ success: true, message: "Completed visit injected." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "حدث خطأ غير متوقع في الخادم" } });
  }
});

module.exports = router;
