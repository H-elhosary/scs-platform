// =============================================
// Smart Clinic OS (Ops Console) — Email Notification Service
// Professional HTML Templates with RTL & Platform Branding
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
      console.log('📧 Admin SMTP Email Transporter connected successfully.');
    } catch (e) {
      console.warn('⚠️ SMTP config error in Admin app. Falling back to Console Email Simulation Mode.', e.message);
      transporter = null;
    }
  } else {
    transporter = null;
  }
};

initTransporter();

/**
 * Base email wrapper with premium responsive HTML styling, Arabic RTL, and Platform Branding
 */
function buildHtmlTemplate({
  badgeText = 'إدارة منصة عيادتي الذكية SCS',
  title = '',
  preheader = '',
  contentHtml = '',
  actionButton = null
}) {
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
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #2563eb 100%);
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
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }
    .signature {
      background: #f8fafc;
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

      <!-- Ops Signature -->
      <tr>
        <td class="signature">
          <div class="signature-title">⚙️ فريق عمليات وتشغيل منصة Smart Clinic OS</div>
          <div class="signature-meta">
            🌐 <strong>الدعم والعمليات:</strong> ops@SCS-ops.com<br>
            🔒 <strong>الأمان والامتثال:</strong> مشفر ومحمي وفق معايير HIPAA
          </div>
        </td>
      </tr>

      <!-- System Footer -->
      <tr>
        <td class="footer">
          تم إرسال هذا البريد الرسمي من نظام إدارة العمليات <strong>Smart Clinic OS</strong>.<br>
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
  const fromName = process.env.SMTP_FROM_NAME || 'منصة عيادتي الذكية — العمليات';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'ops@SCS-ops.com';
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
      console.log(`✅ [Real Admin Email Sent] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [Admin Email Error] Failed to send email to ${to}:`, err.message);
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
  console.log(`📧 [ADMIN EMAIL SIMULATOR — بريد العمليات والإدارة]`);
  console.log(`📤 من: Smart Clinic OS Ops <ops@SCS-ops.com>`);
  console.log(`📥 إلى: ${to}`);
  console.log(`📌 الموضوع: ${subject}`);
  console.log(`⏰ التوقيت: ${new Date().toLocaleString('ar-EG')}`);
  console.log(`------------------------------------------------------`);
  console.log(`📄 المحتوى (نصياً):`);
  console.log(content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 350) + '...');
  console.log(`======================================================\n`);
}

// =============================================
// Admin Domain Notifications
// =============================================

/**
 * 1. إشعار ترحيب بالعيادة الجديدة المنضمة للمنصة مع بيانات الدخول ورابط التفعيل
 */
async function notifyNewClinicWelcome({ tenant, owner, temporaryPassword = 'SecurePassword123!', activationLink }) {
  const recipient = owner?.email || tenant?.email;
  if (!recipient) return;

  const subject = `🎉 مرحباً بك في منصة عيادتي الذكية — تم إنشاء حساب عيادة ${tenant.name}`;

  const contentHtml = `
    <p>سعادة <strong>${owner?.full_name || 'دكتورنا الفاضل'}</strong>،</p>
    <p>يسعدنا انضمامكم إلى منصة <strong>Smart Clinic OS</strong> الرائدة في أتمتة العيادات الطبية وإدارتها بالذكاء الاصطناعي. تم تجهيز بيئة العمل الخاصة بعيادتكم بنجاح:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">اسم العيادة:</span>
        <span class="info-val" style="color: #2563eb; font-size: 16px;">${tenant.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">رابط العيادة (Slug):</span>
        <span class="info-val"><code>/${tenant.slug}</code></span>
      </div>
      <div class="info-row">
        <span class="info-label">باقة الاشتراك:</span>
        <span class="info-val" style="color: #16a34a; font-weight: 800;">باقة ${tenant.subscription_plan.toUpperCase()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ انتهاء الاشتراك:</span>
        <span class="info-val">${new Date(tenant.expires_at).toLocaleDateString('ar-EG')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">البريد المعتمد لتسجيل الدخول:</span>
        <span class="info-val">${recipient}</span>
      </div>
      <div class="info-row">
        <span class="info-label">كلمة المرور المؤقتة:</span>
        <span class="info-val"><code style="font-size: 15px; font-weight: bold; color: #dc2626; background: #fee2e2; padding: 4px 8px; border-radius: 6px;">${temporaryPassword}</code></span>
      </div>
    </div>

    <p style="font-size: 14px;">
      💡 يُرجى تسجيل الدخول عبر الرابط المباشر أدناه لتغيير كلمة المرور والبدء في إدارة العيادة وإضافة المواعيد والخدمات.
    </p>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'انضمام عيادة جديدة',
    title: 'أهلاً بك في عيادتي الذكية',
    preheader: `تم إنشاء مساحة العمل الخاصة بعيادتك بنجاح`,
    contentHtml,
    actionButton: {
      text: 'الدخول إلى لوحة تحكم العيادة',
      url: activationLink || `http://localhost:3001`
    }
  });

  return sendEmail({ to: recipient, subject, html });
}

/**
 * 2. إشعار تنبيه العمليات بانضمام عيادة جديدة
 */
async function notifyOpsNewClinicOnboarded({ tenant, owner }) {
  const opsEmail = process.env.OPS_EMAIL || 'ops@SCS-ops.com';
  const subject = `🏥 انضمام عيادة جديدة: ${tenant.name} (${tenant.subscription_plan.toUpperCase()})`;

  const contentHtml = `
    <p>فريق العمليات،</p>
    <p>تم تسجيل وتفعيل عيادة جديدة بنجاح في المنصة:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">العيادة:</span>
        <span class="info-val">${tenant.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">المالك:</span>
        <span class="info-val">${owner?.full_name || 'طبيب مالك'} (${owner?.email || 'بدون إيميل'})</span>
      </div>
      <div class="info-row">
        <span class="info-label">الباقة:</span>
        <span class="info-val">${tenant.subscription_plan.toUpperCase()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الصلاحية:</span>
        <span class="info-val">${new Date(tenant.expires_at).toLocaleDateString()}</span>
      </div>
    </div>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'تنبيه العمليات',
    title: 'عيادة جديدة منضمة للمنصة',
    preheader: `تم تفعيل عيادة ${tenant.name}`,
    contentHtml,
    actionButton: {
      text: 'عرض العيادة في لوحة العمليات',
      url: `http://localhost:3002/clinics.html`
    }
  });

  return sendEmail({ to: opsEmail, subject, html });
}

/**
 * 3. إشعار تحديث أو تمديد اشتراك العيادة
 */
async function notifyClinicSubscriptionUpdated({ tenant, ownerEmail, oldPlan, newPlan, newExpiresAt, reason }) {
  const recipient = ownerEmail || 'clinic_info@noor.com';
  const subject = `🔄 تم تحديث باقة اشتراك عيادتكم — ${tenant.name}`;

  const contentHtml = `
    <p>سعادة مدير عيادة <strong>${tenant.name}</strong>،</p>
    <p>نحيطكم علماً بأنه تم تحديث بيانات اشتراككم في منصة Smart Clinic OS بنجاح:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">الباقة السابقة:</span>
        <span class="info-val">${(oldPlan || 'الأساسية').toUpperCase()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الباقة الجديدة المعتمدة:</span>
        <span class="info-val" style="color: #16a34a; font-size: 16px;">${newPlan.toUpperCase()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الصلاحية الجديد:</span>
        <span class="info-val">📅 ${new Date(newExpiresAt).toLocaleDateString('ar-EG')}</span>
      </div>
      ${reason ? `
      <div class="info-row">
        <span class="info-label">بيان التعديل:</span>
        <span class="info-val">${reason}</span>
      </div>
      ` : ''}
    </div>

    <p style="font-size: 13px; color: #64748b;">
      تمت ترقية وتحديث المزايا المتاحة في لوحة التحكم الخاصة بكم فوراً.
    </p>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'تحديث الاشتراك',
    title: 'تم تحديث اشتراك العيادة',
    preheader: `الباقة الجديدة: ${newPlan.toUpperCase()}`,
    contentHtml,
    actionButton: {
      text: 'فتح لوحة التحكم',
      url: `http://localhost:3001`
    }
  });

  return sendEmail({ to: recipient, subject, html });
}

/**
 * 4. إشعار الرد على تذكرة أو شكوى العيادة من قبل المشغل
 */
async function notifyClinicTicketReplied({ ticket, clinicEmail, responseNotes, status }) {
  const recipient = clinicEmail || 'clinic_info@noor.com';
  const subject = `💬 تم الرد على طلبكم #${ticket.id}: "${ticket.title}"`;

  const statusLabels = {
    resolved: 'تم الحل بنجاح ✅',
    processing: 'قيد المعالجة ⏳',
    rejected: 'مرفوض ❌',
    pending: 'قيد الانتظار ⏱️'
  };

  const contentHtml = `
    <p>إدارة عيادة <strong>${ticket.tenant_name || 'المحترمة'}</strong>،</p>
    <p>قام فريق الدعم الفني والعمليات بالرد على تذكرتكم وتحديث حالتها:</p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">رقم التذكرة:</span>
        <span class="info-val" style="color: #2563eb;">#${ticket.id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">موضوع الطلب:</span>
        <span class="info-val">${ticket.title}</span>
      </div>
      <div class="info-row">
        <span class="info-label">حالة الطلب الحالية:</span>
        <span class="info-val" style="font-weight: 800;">${statusLabels[status] || status}</span>
      </div>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <div style="color: #166534; font-weight: bold; font-size: 14px; margin-bottom: 6px;">📝 رد فريق العمليات والدعم:</div>
      <div style="color: #14532d; font-size: 15px; line-height: 1.6;">${responseNotes || 'تم مراجعة طلبكم واتخاذ الإجراء اللازم.'}</div>
    </div>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'رد الدعم الفني',
    title: 'تم تحديث تذكرة الدعم',
    preheader: `رد على التذكرة #${ticket.id}`,
    contentHtml,
    actionButton: {
      text: 'عرض التذاكر في لوحة العيادة',
      url: `http://localhost:3001`
    }
  });

  return sendEmail({ to: recipient, subject, html });
}

/**
 * 5. إشعار تعليق أو تفعيل حساب العيادة
 */
async function notifyClinicStatusChanged({ tenant, ownerEmail, status }) {
  const recipient = ownerEmail || 'clinic_info@noor.com';
  const isSuspended = status === 'suspended';
  const subject = isSuspended 
    ? `⚠️ تنبيه هام: تم تعليق وصول عيادة ${tenant.name}`
    : `✅ تم إعادة تفعيل وصول عيادة ${tenant.name}`;

  const contentHtml = `
    <p>إدارة عيادة <strong>${tenant.name}</strong>،</p>
    <p>
      ${isSuspended 
        ? 'نحيطكم علماً بأنه قد تم تعليق وصول حساب العيادة مؤقتاً لأسباب تتعلق بانتهاء الاشتراك أو المراجعة الإدارية.' 
        : 'يسعدنا إبلاغكم بأنه تم رفع التعليق وإعادة تفعيل كامل خدمات العيادة بنجاح.'}
    </p>

    <div class="info-card" style="border-color: ${isSuspended ? '#fecaca' : '#bbf7d0'}; background: ${isSuspended ? '#fff5f5' : '#f0fdf4'};">
      <div class="info-row">
        <span class="info-label">اسم العيادة:</span>
        <span class="info-val">${tenant.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الحالة الجديدة:</span>
        <span class="info-val" style="color: ${isSuspended ? '#dc2626' : '#16a34a'}; font-size: 16px;">
          ${isSuspended ? 'معلق (SUSPENDED)' : 'نشط (ACTIVE)'}
        </span>
      </div>
    </div>

    ${isSuspended ? `
    <p style="font-size: 13px; color: #64748b;">
      لإعادة التفعيل أو الاستفسار عن تجديد الاشتراك، يُرجى التواصل الفوري مع فريق العمليات عبر <a href="mailto:ops@SCS-ops.com">ops@SCS-ops.com</a>.
    </p>
    ` : ''}
  `;

  const html = buildHtmlTemplate({
    badgeText: 'حالة حساب العيادة',
    title: isSuspended ? 'تم تعليق الحساب' : 'تم تفعيل الحساب',
    preheader: `تحديث حالة عيادة ${tenant.name}`,
    contentHtml,
    actionButton: {
      text: isSuspended ? 'التواصل مع الدعم الفني' : 'الدخول للنظام',
      url: `http://localhost:3001`
    }
  });

  return sendEmail({ to: recipient, subject, html });
}

/**
 * 6. إشعار إعادة تعيين كلمة مرور الطبيب / المالك
 */
async function notifyDoctorPasswordReset({ owner, tenant, resetLink, temporaryPassword }) {
  const recipient = owner.email;
  const subject = `🔐 كلمة المرور الجديدة لحسابكم — منصة عيادتي الذكية`;

  const contentHtml = `
    <p>د. <strong>${owner.full_name}</strong>،</p>
    <p>تمت إعادة تعيين كلمة المرور لحسابكم في عيادة <strong>${tenant.name}</strong> بنجاح.</p>
    
    <div class="info-card">
      <div class="info-row">
        <span class="info-label">البريد الإلكتروني:</span>
        <span class="info-val">${recipient}</span>
      </div>
      ${temporaryPassword ? `
      <div class="info-row">
        <span class="info-label">كلمة المرور الجديدة:</span>
        <span class="info-val"><code style="font-size: 16px; font-weight: bold; color: #dc2626; background: #fee2e2; padding: 4px 8px; border-radius: 6px;">${temporaryPassword}</code></span>
      </div>
      ` : ''}
    </div>

    <p style="font-size: 14px;">
      💡 يُمكنك تسجيل الدخول فوراً باستخدام كلمة المرور أعلاه وتغييرها من إعدادات الحساب في أي وقت.
    </p>
  `;

  const html = buildHtmlTemplate({
    badgeText: 'أمان الحساب',
    title: 'إعادة تعيين كلمة المرور',
    preheader: `تم توليد كلمة مرور جديدة لحسابكم`,
    contentHtml,
    actionButton: {
      text: 'تسجيل الدخول للعيادة',
      url: resetLink || `http://localhost:3001`
    }
  });

  return sendEmail({ to: recipient, subject, html });
}

module.exports = {
  sendEmail,
  buildHtmlTemplate,
  notifyNewClinicWelcome,
  notifyOpsNewClinicOnboarded,
  notifyClinicSubscriptionUpdated,
  notifyClinicTicketReplied,
  notifyClinicStatusChanged,
  notifyDoctorPasswordReset
};
