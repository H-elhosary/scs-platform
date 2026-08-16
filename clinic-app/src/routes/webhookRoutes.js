const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const botController = require('../services/botController');

/**
 * 1. WhatsApp Webhook Verification (Meta API)
 */
router.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[WhatsApp Webhook Verification] Mode: ${mode}, Token: ${token}`);

  if (mode === 'subscribe' && token === 'my_secret_token') {
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
    const body = req.body;
    console.log(`[WhatsApp Webhook Received]`, JSON.stringify(body, null, 2));

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

      console.log(`\n💬 [WhatsApp Received] From: ${fromNumber} (${name}): "${text}"`);

      // Handle message
      const botResponse = await botController.handleIncomingMessage(tenantId, 'whatsapp', fromNumber, text, name);

      // Print simulated outgoing reply
      console.log(`\n==========================================`);
      console.log(`📱 [WhatsApp Outgoing Reply] To: ${fromNumber}`);
      console.log(`✉️ Message:\n${botResponse.reply}`);
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 3. Telegram Message Webhook Receiver
 */
router.post('/webhooks/telegram', async (req, res) => {
  try {
    const body = req.body;
    console.log(`[Telegram Webhook Received]`, JSON.stringify(body, null, 2));

    const message = body.message;
    if (message) {
      const chatId = message.chat.id.toString();
      const text = message.text || '';
      const firstName = message.from ? message.from.first_name : 'مريض';

      const tenantId = "a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

      console.log(`\n💬 [Telegram Received] From Chat ID: ${chatId} (${firstName}): "${text}"`);

      const botResponse = await botController.handleIncomingMessage(tenantId, 'telegram', chatId, text, firstName);

      console.log(`\n==========================================`);
      console.log(`📱 [Telegram Outgoing Reply] To Chat ID: ${chatId}`);
      console.log(`✉️ Message:\n${botResponse.reply}`);
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 4. Paymob Callback Webhook handler
 */
router.post('/webhooks/payments/paymob', async (req, res) => {
  try {
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
      if (db.isMock) {
        const appt = db.memoryDB.appointments.find(a => a.id === appointmentId);
        if (appt) appt.status = 'confirmed';

        const inv = db.memoryDB.invoices.find(i => i.id === invoiceId);
        if (inv) inv.status = 'paid';
      } else {
        await db.query(`UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = $1`, [appointmentId]);
        await db.query(`UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = $1`, [invoiceId]);
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 5. Simulated Paymob Portal page (Interactive UI)
 */
router.get('/webhooks/payments/paymob/simulate', (req, res) => {
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
router.get('/webhooks/payments/bot-state', (req, res) => {
  const { phone } = req.query;
  const state = botController.conversationStates[phone] || { step: 'IDLE' };
  return res.status(200).json({ success: true, state: state.step });
});

/**
 * 7. Debug Endpoint: Reset Bot State
 */
router.post('/webhooks/payments/reset-state', (req, res) => {
  const { phone } = req.body;
  if (phone) {
    delete botController.conversationStates[phone];
  }
  return res.status(200).json({ success: true });
});

/**
 * 8. Debug Endpoint: Seed Completed Visit for 14-days free followup check
 */
router.post('/webhooks/payments/seed-visit', async (req, res) => {
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
