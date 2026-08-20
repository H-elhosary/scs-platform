// =============================================
// Smart Clinic OS — Email Notification Service
// Professional HTML Templates with RTL & Clinic Signature
// Supports SMTP (via Nodemailer) + Console Simulation Fallback
// =============================================

const nodemailer = require('nodemailer');
require('dotenv').config();

// Create Transporter
let transporter = null;

const initTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT == 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('📧 SMTP Email Transporter connected successfully.');
    } catch (e) {
      console.warn('⚠️ SMTP config error. Falling back to Console Email Simulation Mode.', e.message);
      transporter = null;
    }
  } else {
    transporter = null; // Simulation mode
  }
};

initTransporter();

/**
 * Base email wrapper with premium responsive HTML styling, Arabic RTL, and Clinic Signature
 */
function buildHtmlTemplate({
  badgeText = 'منصة عيادتي الذكية',
  title = '',
  preheader = '',
  contentHtml = '',
  clinic = null,
  actionButton = null // { text: '', url: '' }
}) {
  const clinicName = clinic?.name || 'عيادتي الذكية';
  const clinicPhone = clinic?.phone || '+20 10 1234 5678';
  const clinicSpecialty = clinic?.specialty === 'dental' ? 'طب وجراحة الأسنان' : (clinic?.specialty === 'orthopedic' ? 'جراحة العظام والمفاصل' : 'الرعاية الطبية التخصصية');

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #0b1120;
      color: #334155;
      direction: rtl;
      text-align: right;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0b1120;
      padding: 30px 0;
    }
    .main-table {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      border: 1px solid #1e293b;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
      padding: 36px 30px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
    }
    .body {
      padding: 32px 30px;
      background-color: #ffffff;
      font-size: 15px;
      line-height: 1.7;
      color: #1e293b;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
    }
    .info-val {
      color: #0f172a;
      font-weight: 700;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 10px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
    }
    .signature {
      background: #f1f5f9;
      border-top: 2px solid #e2e8f0;
      padding: 24px 30px;
      margin-top: 10px;
    }
    .signature-title {
      font-weight: 800;
      font-size: 16px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .signature-meta {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
    }
    .footer {
      background-color: #0f172a;
      color: #94a3b8;
      padding: 20px;
      text-align: center;
      font-size: 12px;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" cellpadding="0" cellspacing="0" width="100%">
      <!-- Header -->
      <tr>
        <td class="header">
          <div class="badge">${badgeText}</div>
          <h1>${title}</h1>
          ${preheader ? `<p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${preheader}</p>` : ''}
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td class="body">
          ${contentHtml}

          ${actionButton ? `
            <div class="btn-container">
              <a href="${actionButton.url}" class="btn" target="_blank">${actionButton.text}</a>
            </div>
          ` : ''}
        </td>
      </tr>

      <!-- Clinic Signature Section -->
      <tr>
        <td class="signature">
          <div class="signature-title">🏥 ${clinicName}</div>
          <div class="signature-meta">
            🩺 <strong>التخصص:</strong> ${clinicSpecialty}<br>
            📞 <strong>خدمة العملاء والحجوزات:</strong> ${clinicPhone}<br>
            📍 <strong>النظام:</strong> مدعوم بواسطة Smart Clinic OS
          </div>
        </td>
      </tr>

      <!-- System Footer -->
      <tr>
        <td class="footer">
          تم إرسال هذا الإشعار تلقائياً من منصة <strong>Smart Clinic OS</strong>.<br>
          جميع الحقوق محفوظة &copy; ${new Date().getFullYear()}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

/**
 * Core Send Email function
 */
async function sendEmail({ to, subject, html, text }) {
  const fromName = process.env.SMTP_FROM_NAME || 'منصة عيادتي الذكية';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@scs-platform.com';
  const sender = `"${fromName}" <${fromEmail}>`;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: sender,
        to,
        subject,
        text: text || subject,
        html
      });
      console.log(`✅ [Real Email Sent] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [Real Email Error] Failed to send email to ${to}:`, err.message);
      // Fallback log
      logSimulatedEmail(to, subject, text || html);
      return { success: false, error: err.message };
    }
  } else {
    // Console Simulation Mode
    logSimulatedEmail(to, subject, text || html);
    return { success: true, simulated: true };
  }
}

function logSimulatedEmail(to, subject, content) {
  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL SIMULATOR — الإشعار البريدي الصادر]`);
  console.log(`📤 من: Smart Clinic OS <noreply@scs-platform.com>`);
  console.log(`📥 إلى: ${to}`);
  console.log(`📌 الموضوع: ${subject}`);
  console.log(`⏰ التوقيت: ${new Date().toLocaleString('ar-EG')}`);
  console.log(`------------------------------------------------------`);
  console.log(`📄 المحتوى (نصياً):`);
  console.log(content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) + '...');
  console.log(`======================================================\n`);
}

// =============================================
// Domain-Specific Notification Functions
// =============================================

/**
 * 1. إشعار تأكيد حجز موعد جديد للمريض (مع توقيع العيادة وتفاصيل الموعد)
 */
async function notifyPatientBookingConfirmed({ patient, appointment, service, doctor, clinic }) {
  if (!patient.email) return;

  const subject = `✅ تأكيد حجز موعدك لدى ${clinic?.name || 'العيادة'} [كود الحجز: ${appointment.booking_code}]`;
  
  const contentHtml = `
    <p>مرحباً <strong>${patient.full_name || 'عزيزنا المريض'}</strong>،</p>
    <p>يسعدنا إبلاغك بأنه تم تأكيد حجز موعدك الطبي بنجاح. فيما يلي تفاصيل الموعد المحدد:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">كود الحجز:</span>
        <span class="info-val" style="color: #0284c7; font-size: 16px;">${appointment.booking_code || 'BK-NEW'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الطبيب المعالج:</span>
        <span class="info-val">${doctor?.full_name || 'د. محمد نور'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الخدمة / الإجراء:</span>
        <span class="info-val">${service?.name || 'كشف طبي'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الموعد:</span>
        <span class="info-val">📅 ${appointment.date}</span>
      </div>
      <div class="info-row">
        <span class="info-label">وقت الحضور:</span>
        <span class="info-val">⏰ ${appointment.time}</span>
      </div>
      <div class="info-row">
        <span class="info-label">رقم الانتظار التقريبي:</span>
        <span class="info-val">#${appointment.queue_number || 1}</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع:</span>
        <span class="info-val">${appointment.payment_method === 'online' ? '💳 سداد إلكتروني (تم الدفع)' : '💵 نقداً في العيادة'}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #64748b;">
      💡 يرجى التكرم بالحضور قبل موعدك بـ 10 دقائق لإنهاء إجراءات الدخول، وإبراز كود الحجز لمسؤولة الاستقبال.
    </p>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'تأكيد الحجز الطبي',
    title: 'تم تأكيد موعدك بنجاح',
    preheader: `موعدك يوم ${appointment.date} الساعة ${appointment.time}`,
    contentHtml,
    clinic,
    actionButton: {
      text: 'عرض تذكرة الموعد',
      url: `http://localhost:3001`
    }
  });

  return sendEmail({ to: patient.email, subject, html });
}

/**
 * 2. إشعار تنبيه الطبيب بحجز موعد جديد
 */
async function notifyDoctorNewBooking({ doctor, patient, appointment, service, clinic }) {
  const doctorEmail = doctor?.email || 'clinic_info@noor.com';
  const subject = `🗓️ موعد جديد محجوز: ${patient.full_name} (${appointment.date} - ${appointment.time})`;

  const contentHtml = `
    <p>د. <strong>${doctor?.full_name || 'طبيبنا العزيز'}</strong>،</p>
    <p>تم تسجيل حجز جديد في جدول مواعيدك بالعيادة:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">اسم المريض:</span>
        <span class="info-val">${patient.full_name} (${patient.phone || 'بدون هاتف'})</span>
      </div>
      <div class="info-row">
        <span class="info-label">الخدمة:</span>
        <span class="info-val">${service?.name || 'كشف'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الموعد:</span>
        <span class="info-val">📅 ${appointment.date} في تمام ${appointment.time}</span>
      </div>
      <div class="info-row">
        <span class="info-label">نوع الزيارة:</span>
        <span class="info-val">${appointment.visit_type === 'followup' ? 'إعادة كشف / متابعة' : 'كشف جديد'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">ملاحظات الحجز:</span>
        <span class="info-val">${appointment.notes || 'لا توجد ملاحظات'}</span>
      </div>
    </div>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'تنبيه الأطباء',
    title: 'موعد كشف جديد مضاف',
    preheader: `تم حجز موعد جديد مع المريض ${patient.full_name}`,
    contentHtml,
    clinic,
    actionButton: {
      text: 'فتح جدول المواعيد',
      url: `http://localhost:3001/calendar.html`
    }
  });

  return sendEmail({ to: doctorEmail, subject, html });
}

/**
 * 3. إشعار إلغاء الموعد للمريض
 */
async function notifyPatientBookingCancelled({ patient, appointment, clinic, reason }) {
  if (!patient.email) return;

  const subject = `⚠️ تنبيه: تم إلغاء موعدك لدى ${clinic?.name || 'العيادة'} [كود: ${appointment.booking_code}]`;

  const contentHtml = `
    <p>مرحباً <strong>${patient.full_name}</strong>،</p>
    <p>نحيطكم علماً بأنه تم إلغاء حجز الموعد الطبي الخاص بكم بناءً على طلبكم أو لظروف طارئة بالعيادة.</p>

    <div class="info-card" style="border-color: #fecaca; background: #fff5f5;">
      <div class="info-row">
        <span class="info-label">كود الحجز:</span>
        <span class="info-val" style="color: #dc2626;">${appointment.booking_code}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الموعد الملغى:</span>
        <span class="info-val">${appointment.date} - ${appointment.time}</span>
      </div>
      ${reason ? `
      <div class="info-row">
        <span class="info-label">سبب الإلغاء:</span>
        <span class="info-val">${reason}</span>
      </div>
      ` : ''}
    </div>

    <p>يمكنكم دائماً إعادة حجز موعد جديد في الوقت الأنسب لكم من خلال البوت الذكي أو عبر موقع العيادة.</p>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'تنبيه إلغاء الحجز',
    title: 'تم إلغاء الموعد الطبي',
    preheader: `تم إلغاء موعد كود ${appointment.booking_code}`,
    contentHtml,
    clinic,
    actionButton: {
      text: 'حجز موعد بديل',
      url: `http://localhost:3001`
    }
  });

  return sendEmail({ to: patient.email, subject, html });
}

/**
 * 4. إشعار اكتمال الكشف والروشتة الطبية للمريض
 */
async function notifyPatientConsultationComplete({ patient, appointment, medicalRecord, clinic }) {
  if (!patient.email) return;

  const subject = `🩺 تقرير الزيارة والروشتة الإلكترونية — ${clinic?.name || 'العيادة'}`;

  const contentHtml = `
    <p>مرحباً <strong>${patient.full_name}</strong>،</p>
    <p>حمداً لله على سلامتكم. تم توثيق زيارتكم الطبية وإصدار الروشتة وخطة العلاج إلكترونياً:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">تاريخ الزيارة:</span>
        <span class="info-val">${appointment?.date || new Date().toISOString().split('T')[0]}</span>
      </div>
      <div class="info-row">
        <span class="info-label">رقم الملف الطبي:</span>
        <span class="info-val">${medicalRecord?.id || 'REC-DOC'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">حالة الكشف:</span>
        <span class="info-val" style="color: #16a34a;">✅ مكتمل ومسجل</span>
      </div>
    </div>

    <p style="font-size: 14px; line-height: 1.6;">
      نتمنى لكم الشفاء العاجل ودوام الصحة والعافية. للمتابعة أو الاستفسار عن الأدوية، تواصلوا معنا في أي وقت.
    </p>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'الملف الطبي الرقمي',
    title: 'اكتملت زيارتكم الطبية',
    preheader: `تم إصدار خطة العلاج والروشتة الإلكترونية`,
    contentHtml,
    clinic,
    actionButton: {
      text: 'تحميل الروشتة PDF',
      url: `http://localhost:3001/v1/prescriptions/${medicalRecord?.id || 'rec-latest'}/pdf`
    }
  });

  return sendEmail({ to: patient.email, subject, html });
}

/**
 * 5. إشعار إيصال سداد إلكتروني (Paymob Webhook / Online)
 */
async function notifyPaymentReceipt({ patient, amount, appointmentId, invoiceId, clinic }) {
  const recipient = patient?.email || 'patient@example.com';
  const subject = `💳 إيصال استلام دفعة إلكترونية بقيمة ${amount} ج.م [فاتورة: ${invoiceId || appointmentId}]`;

  const contentHtml = `
    <p>مرحباً <strong>${patient?.full_name || 'عزيزنا المريض'}</strong>،</p>
    <p>تم استلام دفعتكم بنجاح عبر بوابة السداد الإلكتروني المعتمدة:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">المبلغ المدفوع:</span>
        <span class="info-val" style="color: #16a34a; font-size: 18px;">${amount} جنيه مصري</span>
      </div>
      <div class="info-row">
        <span class="info-label">رقم الفاتورة:</span>
        <span class="info-val">${invoiceId || 'INV-AUTO'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">رقم الحجز المرتبط:</span>
        <span class="info-val">${appointmentId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">حالة المعاملة:</span>
        <span class="info-val" style="color: #16a34a;">مدفوعة ومؤكدة (PAID)</span>
      </div>
    </div>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'إيصال دفع إلكتروني',
    title: 'تم استلام الدفعة بنجاح',
    preheader: `تم تحصيل مبلغ ${amount} ج.م`,
    contentHtml,
    clinic
  });

  return sendEmail({ to: recipient, subject, html });
}

/**
 * 6. إشعار لعمليات المنصة عند إنشاء العيادة لتذكرة دعم جديدة
 */
async function notifyOpsNewTicket({ ticket, clinic }) {
  const opsEmail = process.env.OPS_EMAIL || 'ops@SCS-ops.com';
  const subject = `🎫 تذكرة دعم جديدة #${ticket.id} من عيادة: ${clinic?.name || ticket.tenant_name}`;

  const contentHtml = `
    <p>فريق العمليات والدعم الفني،</p>
    <p>تم استلام تذكرة دعم فني / طلب اشتراك جديدة من العيادة:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">رقم التذكرة:</span>
        <span class="info-val" style="color: #0284c7;">#${ticket.id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">العيادة:</span>
        <span class="info-val">${clinic?.name || ticket.tenant_name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">نوع الطلب:</span>
        <span class="info-val">${ticket.type_ar || ticket.type}</span>
      </div>
      <div class="info-row">
        <span class="info-label">عنوان التذكرة:</span>
        <span class="info-val">${ticket.title}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تفاصيل المشكلة / الطلب:</span>
        <span class="info-val">${ticket.description}</span>
      </div>
    </div>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'منصة العمليات SCS Ops',
    title: 'تذكرة دعم فني جديدة',
    preheader: `طلب جديد من ${clinic?.name || ticket.tenant_name}`,
    contentHtml,
    clinic,
    actionButton: {
      text: 'معاينة والرد في لوحة التحكم',
      url: `http://localhost:3002/tickets.html`
    }
  });

  return sendEmail({ to: opsEmail, subject, html });
}

/**
 * 7. إشعار نسخة من رد البوت الذكي (Auto-reply transcript)
 */
async function notifyBotAutoReplyCopy({ patient, userMessage, botReply, channel = 'WhatsApp', clinic }) {
  if (!patient?.email) return;

  const subject = `💬 نسخة محادثة المساعد الآلي (${channel}) — ${clinic?.name || 'العيادة'}`;

  const contentHtml = `
    <p>مرحباً <strong>${patient.full_name}</strong>،</p>
    <p>هذه نسخة مرجعية لرد المساعد الذكي الآلي عبر ${channel}:</p>

    <div class="info-card">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;"><strong>رسالتكم:</strong></p>
      <p style="margin: 0 0 16px 0; background: #e2e8f0; padding: 10px; border-radius: 8px;">${userMessage}</p>

      <p style="margin: 0 0 8px 0; color: #0284c7; font-size: 13px;"><strong>رد البوت الآلي:</strong></p>
      <p style="margin: 0; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 8px; color: #166534; white-space: pre-line;">${botReply}</p>
    </div>
  `;

  const html = buildHtmlTemplate({
    badgeText: `مساعد ${channel} الذكي`,
    title: 'ملخص المحادثة الفورية',
    preheader: `رسالة تلقائية من المساعد الذكي`,
    contentHtml,
    clinic
  });

  return sendEmail({ to: patient.email, subject, html });
}

module.exports = {
  sendEmail,
  buildHtmlTemplate,
  notifyPatientBookingConfirmed,
  notifyDoctorNewBooking,
  notifyPatientBookingCancelled,
  notifyPatientConsultationComplete,
  notifyPaymentReceipt,
  notifyOpsNewTicket,
  notifyBotAutoReplyCopy
};
