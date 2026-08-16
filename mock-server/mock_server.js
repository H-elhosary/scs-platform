const express = require('express');
const cors = require('cors');
const path = require('path');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Load openapi.yaml
const openapiPath = path.join(__dirname, 'openapi.yaml');
let swaggerDocument;
try {
  swaggerDocument = YAML.load(openapiPath);
  console.log('✅ Loaded openapi.yaml successfully.');
} catch (error) {
  console.error('❌ Error loading openapi.yaml:', error.message);
  process.exit(1);
}

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
console.log(`📖 Swagger UI is available at http://localhost:${PORT}/api-docs`);

// --- Mock Database / In-Memory State ---
const db = {
  memoryDB: {
    doctors: [
      { id: "doc-uuid-noor-1", tenant_id: "tenant-uuid-noor", full_name: "د. محمد نور", specialty: "طب أسنان عام" }
    ],
    doctorWorkingHours: {}
  }
};

const mockPlans = [
  {
    id: "basic",
    name: "Basic",
    price_usd: 50,
    price_egp: 2500,
    allow_multi_doctor: false,
    allow_insurance: false,
    allow_refunds: false,
    allow_whatsapp: false,
    allow_telegram: false,
    allow_analytics: false,
    allow_voice_bot: false,
    allow_custom_branding: false
  },
  {
    id: "pro",
    name: "Pro",
    price_usd: 100,
    price_egp: 5000,
    allow_multi_doctor: true,
    allow_insurance: false,
    allow_refunds: false,
    allow_whatsapp: true,
    allow_telegram: false,
    allow_analytics: true,
    allow_voice_bot: false,
    allow_custom_branding: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_usd: 250,
    price_egp: 12500,
    allow_multi_doctor: true,
    allow_insurance: true,
    allow_refunds: true,
    allow_whatsapp: true,
    allow_telegram: true,
    allow_analytics: true,
    allow_voice_bot: true,
    allow_custom_branding: true
  }
];

let clinicNotificationSettings = {
  patient_email_booking_confirm: true,
  patient_whatsapp_booking_confirm: true,
  patient_email_prescription: true,
  patient_email_invoice: true,
  doctor_email_new_booking: true,
  doctor_whatsapp_new_booking: false,
  doctor_email_daily_report: true,
  doctor_email_weekly_report: true
};

let clinicOperationalSettings = {
  cancellation_window_hours: 6,
  payment_timeout_minutes: 15,
  followup_grace_period_days: 14,
  allow_bot_followups: true,
  refund_destination: 'wallet'
};

let clinicPrescriptionSettings = {
  header_ar: 'عيادة النور لطب الأسنان',
  header_en: 'Al-Nour Dental Clinic',
  theme_color: '#1a73e8',
  footer_text: 'نتمنى لكم الشفاء العاجل',
  logo_url: ''
};

let clinicRefundSettings = {
  refund_destination: 'wallet'
};

let clinicChannelSettings = {
  bot_greeting: 'مرحباً بك في نظام الحجز الذكي لعيادة النور!\n\nيرجى اختيار الرقم المناسب للمتابعة:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم',
  whatsapp: {
    enabled: false,
    phone_number_id: '',
    business_account_id: '',
    access_token: '',
    webhook_url: 'https://api.smartclinic.com/webhooks/whatsapp/tenant-uuid-noor',
    verify_token: 'scs_verify_' + Math.random().toString(36).substring(2, 10),
    status: 'disconnected',
    last_tested_at: null
  },
  telegram: {
    enabled: false,
    bot_token: '',
    bot_username: '',
    webhook_url: 'https://api.smartclinic.com/webhooks/telegram/tenant-uuid-noor',
    status: 'disconnected',
    last_tested_at: null
  }
};

const fs = require('fs');
const SETTINGS_FILE_PATH = path.join(__dirname, 'settings_db.json');

function saveSettingsToDisk() {
  try {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(clinicChannelSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings to disk:', e);
  }
}

function loadSettingsFromDisk() {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      clinicChannelSettings = JSON.parse(data);
      console.log('✅ Loaded clinic settings from settings_db.json');
    } else {
      saveSettingsToDisk();
    }
  } catch (e) {
    console.error('Failed to load settings from disk:', e);
  }
}

loadSettingsFromDisk();

let tgPollingInterval = null;
let lastTgUpdateId = 0;

function getTelegramKeyboard(replyText) {
  const lines = replyText.split('\n');
  const buttons = [];
  
  lines.forEach(line => {
    const match = line.trim().match(/^(\d+)[\.\-\)]\s*(.+)$/);
    if (match) {
      buttons.push([{ text: line.trim() }]);
    }
  });
  
  if (buttons.length > 0) {
    return {
      keyboard: buttons,
      resize_keyboard: true,
      one_time_keyboard: true
    };
  }
  return null;
}

function startTelegramPolling() {
  if (tgPollingInterval) {
    clearInterval(tgPollingInterval);
    tgPollingInterval = null;
  }
  
  const token = clinicChannelSettings.telegram.bot_token;
  if (!token) {
    console.log(`[Telegram Bot] No token found. Polling disabled.`);
    return;
  }
  
  console.log(`[Telegram Bot] Starting long polling loop...`);
  
  tgPollingInterval = setInterval(async () => {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastTgUpdateId + 1}&timeout=1`;
      const res = await fetch(url).then(r => r.json());
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          lastTgUpdateId = update.update_id;
          const message = update.message;
          if (message && message.text) {
            const chatId = message.chat.id.toString();
            const text = message.text;
            const firstName = message.from.first_name || 'مريض';
            
            console.log(`[Telegram Bot Poll] Message received from ${firstName} (${chatId}): "${text}"`);
            
            // 1. Process message locally using our bot simulator logic
            const botResponse = handleBotMessage(chatId, text, firstName);
            
            // 2. Add to mockConversations so it shows in the clinic Inbox!
            let conv = mockConversations.find(c => c.id === `tg-${chatId}` || c.patient_phone === chatId);
            if (!conv) {
              conv = {
                id: `tg-${chatId}`,
                tenant_id: "tenant-uuid-noor",
                patient_id: `pat-tg-${chatId}`,
                patient_name: `${firstName} (تليجرام)`,
                patient_phone: chatId,
                channel: "telegram",
                bot_active: true,
                last_message: text,
                last_message_at: new Date().toISOString(),
                unread_count: 0,
                status: "active",
                messages: []
              };
              mockConversations.push(conv);
            }
            
            // Add user message
            conv.messages.push({
              id: `msg-tg-in-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              sender: "patient",
              body: text,
              text: text,
              timestamp: new Date().toISOString()
            });
            
            // Add bot reply if bot is active for this conversation and bot_enabled is true
            const botEnabled = clinicChannelSettings.telegram.enabled;
            if (botEnabled && conv.bot_active && botResponse && botResponse.reply) {
              conv.messages.push({
                id: `msg-tg-out-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                sender: "bot",
                body: botResponse.reply,
                text: botResponse.reply,
                timestamp: new Date().toISOString()
              });
              
              // Generate Reply Keyboard for Telegram based on choices
              const keyboard = getTelegramKeyboard(botResponse.reply);
              const payload = {
                chat_id: chatId,
                text: botResponse.reply
              };
              if (keyboard) {
                payload.reply_markup = keyboard;
              } else {
                // If no numbered choices, remove keyboard so they can type freely (e.g. entering name)
                payload.reply_markup = { remove_keyboard: true };
              }
              
              // Send the reply back to the real Telegram chat!
              const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
              await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            } else {
              conv.unread_count += 1;
            }
            
            conv.last_message = text;
            conv.last_message_at = new Date().toISOString();
          }
        }
      }
    } catch (e) {
      // Quietly ignore network/timeout errors during polling
    }
  }, 2000);
}

let clinicInsuranceCompanies = [
  { id: 'ins-axa', name_ar: 'أكسا للتأمين (AXA)', name_en: 'AXA Insurance', active: true, coverage: 80 },
  { id: 'ins-bupa', name_ar: 'بوبا العربية (Bupa)', name_en: 'Bupa Arabia', active: true, coverage: 90 },
  { id: 'ins-metlife', name_ar: 'ميتلايف (MetLife)', name_en: 'MetLife', active: false, coverage: 70 }
];


const mockTenants = [
  {
    id: "tenant-uuid-noor",
    name: "عيادة النور لطب الأسنان",
    slug: "dr-mohamed-noor",
    status: "active",
    subscription_plan: "pro",
    specialty: "dental",
    allow_multi_doctor: true,
    allow_insurance: false,
    allow_refunds: false,
    expires_at: "2027-07-01T20:00:00Z",
    owner_name: "د. محمد نور",
    owner_email: "clinic_info@noor.com",
    owner_phone: "+201012345678"
  },
  {
    id: "tenant-uuid-ahmed",
    name: "عيادة د. أحمد التجميلية",
    slug: "dr-ahmed-derma",
    status: "active",
    subscription_plan: "enterprise",
    specialty: "dermatology",
    allow_multi_doctor: true,
    allow_insurance: true,
    allow_refunds: true,
    expires_at: "2026-05-01T00:00:00Z",
    owner_name: "د. أحمد التجميلي",
    owner_email: "dr.ahmed@derma.com",
    owner_phone: "+201211112222"
  }
];

const mockSubscriptionHistory = [];
const mockAdminAuditLogs = [];

const mockTickets = [
  {
    id: "TKT-1001",
    tenant_id: "tenant-uuid-noor",
    tenant_name: "عيادة د. نور لطب الأسنان",
    type: "upgrade",
    type_ar: "ترقية الباقة",
    title: "طلب ترقية لباقة المؤسسات لتفعيل التأمين الطبي",
    description: "نريد ترقية اشتراكنا الحالي إلى باقة المؤسسات (Enterprise) لتمكين ميزات التأمين الطبي والاسترداد الإلكتروني للمرضى.",
    status: "pending",
    created_at: "2026-07-04T12:00:00Z",
    response_notes: ""
  },
  {
    id: "TKT-1002",
    tenant_id: "tenant-uuid-noor",
    tenant_name: "عيادة د. نور لطب الأسنان",
    type: "maintenance",
    type_ar: "طلب صيانة",
    title: "مشكلة في تحميل بعض التقارير المالية",
    description: "التقرير المالي الأسبوعي لم يظهر مساء الجمعة الماضي. يرجى التحقق.",
    status: "resolved",
    created_at: "2026-07-03T09:30:00Z",
    response_notes: "تم فحص المشكلة في خادم التحليلات وإعادة إرسال التقرير يدوياً. يجب أن يعمل بشكل سليم الآن."
  }
];


// Helper: Get feature flags based on subscription plan
const getPlanFeatureFlags = (plan) => {
  const p = plan.toLowerCase();
  return {
    allow_multi_doctor: p === 'pro' || p === 'enterprise',
    allow_insurance: p === 'enterprise',
    allow_refunds: p === 'enterprise'
  };
};

// Helper: Log admin actions to audit logs
const logAdminAction = (adminId, action, targetType, targetId, details, req) => {
  const logEntry = {
    id: `audit-${Math.random().toString(36).substring(7)}`,
    admin_id: adminId || 'system',
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ? JSON.stringify(details) : null,
    ip_address: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    user_agent: req.headers['user-agent'] || 'unknown',
    created_at: new Date().toISOString()
  };
  mockAdminAuditLogs.push(logEntry);
};

// --- Mock Routes Implementation ---

// Welcome / Root route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>SCS Mock Server</title>
        <style>
          body { font-family: sans-serif; background: #f0f4f8; text-align: center; padding: 50px; }
          .card { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h1 { color: #2b6cb0; }
          a { background: #3182ce; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-top: 20px; display: inline-block; }
          a:hover { background: #2b6cb0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Smart Clinic OS (SCS) Mock Server</h1>
          <p>The mock server is running successfully!</p>
          <a href="/api-docs">Open Swagger API Docs (اضغط هنا لفتح واجهة تجربة الروابط)</a>
        </div>
      </body>
    </html>
  `);
});

// Platform Admin: Login
app.post('/admin/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log(`[Admin Login Request] Email: ${email}`);
  
  if (email === 'ops@SCS-ops.com') {
    return res.status(200).json({
      success: true,
      data: {
        two_factor_required: true,
        temp_token: "temp_jwt_token_for_2fa_verification"
      }
    });
  } else {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"
      }
    });
  }
});

// Clinic Staff: Login
app.post('/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log(`[Clinic Login Request] Email: ${email}`);
  
  const tenant = mockTenants.find(t => t.owner_email.toLowerCase() === email.toLowerCase());
  if (tenant) {
    return res.status(200).json({
      success: true,
      data: {
        access_token: `mock_jwt_clinic_token_${tenant.id}`,
        user: {
          id: `doctor-uuid-${tenant.id}`,
          email: tenant.owner_email,
          full_name: tenant.owner_name,
          role: "owner"
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subscription_plan: tenant.subscription_plan
        }
      }
    });
  } else {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"
      }
    });
  }
});

// Platform Admin: Verify 2FA
app.post('/admin/v1/auth/verify-2fa', (req, res) => {
  const { temp_token, otp_code } = req.body;
  console.log(`[Verify 2FA Request] Code: ${otp_code}`);
  
  if (otp_code === '123456') {
    return res.status(200).json({
      success: true,
      data: {
        admin: {
          id: "admin-uuid-super",
          email: "ops@SCS-ops.com",
          full_name: "أحمد مشغل النظام",
          role: "super_admin"
        },
        access_token: "mock_jwt_access_token_valid_for_15min",
        refresh_token: "mock_jwt_refresh_token_valid_for_7days"
      }
    });
  } else {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_OTP",
        message: "كود التحقق الثنائي غير صحيح أو منتهي الصلاحية"
      }
    });
  }
});

// Platform Admin: Onboard Tenant
app.post('/admin/v1/tenants', (req, res) => {
  const tenantData = req.body;
  console.log(`[Onboard Tenant Request] Name: ${tenantData.name}, Plan: ${tenantData.subscription_plan}`);
  
  const newTenantId = `tenant-uuid-${Math.random().toString(36).substring(7)}`;
  const newDoctorId = `doctor-uuid-${Math.random().toString(36).substring(7)}`;
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year default
  
  const features = getPlanFeatureFlags(tenantData.subscription_plan);
  const newTenant = {
    id: newTenantId,
    name: tenantData.name,
    slug: tenantData.slug.toLowerCase(),
    status: 'active',
    subscription_plan: tenantData.subscription_plan,
    allow_multi_doctor: features.allow_multi_doctor,
    allow_insurance: features.allow_insurance,
    allow_refunds: features.allow_refunds,
    specialty: tenantData.specialty || 'general',
    expires_at: expiresAt,
    owner_name: `د. مالك عيادة ${tenantData.name}`,
    owner_email: tenantData.email ? tenantData.email.toLowerCase() : `${tenantData.slug}-owner@domain.com`,
    owner_phone: tenantData.phone || "+201012345678"
  };

  mockTenants.push(newTenant);

  // Write audit log
  logAdminAction(
    'admin-uuid-super',
    'tenant.create',
    'tenant',
    newTenantId,
    { name: newTenant.name, slug: newTenant.slug, specialty: newTenant.specialty, subscription_plan: newTenant.subscription_plan },
    req
  );

  // Write subscription history entry
  mockSubscriptionHistory.push({
    id: `sub-hist-${Math.random().toString(36).substring(7)}`,
    tenant_id: newTenantId,
    action: 'created',
    old_plan: null,
    new_plan: newTenant.subscription_plan,
    old_expires_at: null,
    new_expires_at: expiresAt,
    reason: 'Onboarding registration',
    changed_by_admin_id: 'admin-uuid-super',
    created_at: new Date().toISOString()
  });
  
  return res.status(201).json({
    success: true,
    data: {
      tenant_id: newTenantId,
      doctor_id: newDoctorId,
      activation_link: `https://www.SCS-admin.com/activate?token=act_${newTenantId}`
    }
  });
});

// Helper: Calculate estimated MRR based on subscription plan
const getPlanMRR = (plan) => {
  switch (plan) {
    case 'basic': return 50;
    case 'pro': return 100;
    case 'enterprise': return 250;
    default: return 0;
  }
};

// Platform Admin: Get All Tickets
app.get('/admin/v1/tickets', (req, res) => {
  console.log(`[Get All Tickets Request]`);
  return res.status(200).json({
    success: true,
    data: mockTickets
  });
});

// Platform Admin: Update Ticket Status and Notes
app.put('/admin/v1/tickets/:id', (req, res) => {
  const { id } = req.params;
  const { status, response_notes } = req.body;
  console.log(`[Admin Update Ticket Request] ID: ${id}`, { status, response_notes });

  const ticket = mockTickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { message: "التذكرة غير موجودة" }
    });
  }

  if (status !== undefined) ticket.status = status;
  if (response_notes !== undefined) ticket.response_notes = response_notes;

  logAdminAction(
    'admin-uuid-super',
    'UPDATE_TICKET',
    'TICKET',
    id,
    `Updated ticket ${id} status to ${status} with notes.`
  );

  return res.status(200).json({
    success: true,
    data: ticket
  });
});

// Platform Admin: Get Tenants
app.get('/admin/v1/tenants', (req, res) => {
  console.log(`[Get Tenants List Request]`);
  
  const now = new Date();
  const totalClinics = mockTenants.length;
  const activeClinics = mockTenants.filter(t => t.status === 'active' && new Date(t.expires_at) > now).length;
  const suspendedClinics = mockTenants.filter(t => t.status === 'suspended').length;
  
  // Pending Expiry within next 30 days
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pendingExpiry = mockTenants.filter(t => {
    const expiry = new Date(t.expires_at);
    return t.status === 'active' && expiry > now && expiry <= thirtyDaysFromNow;
  }).length;

  // Calculate Estimated MRR and plans breakdown
  let estimatedMRR = 0;
  let basicCount = 0;
  let proCount = 0;
  let enterpriseCount = 0;
  
  mockTenants.forEach(t => {
    const isExpired = new Date(t.expires_at) <= now;
    if (t.status === 'active' && !isExpired) {
      const planId = t.subscription_plan.toLowerCase();
      const planObj = mockPlans.find(p => p.id.toLowerCase() === planId);
      const price = planObj ? planObj.price_usd : 0;
      estimatedMRR += price;
      
      if (planId === 'basic') {
        basicCount++;
      } else if (planId === 'pro') {
        proCount++;
      } else if (planId === 'enterprise') {
        enterpriseCount++;
      }
    }
  });

  const resolvedTenants = mockTenants.map(t => {
    return {
      ...t,
      usage_stats: {
        total_patients: t.slug === 'dr-mohamed-noor' ? 142 : 12,
        total_appointments: t.slug === 'dr-mohamed-noor' ? 450 : 25,
        whatsapp_connection: t.slug === 'dr-mohamed-noor' ? 'connected' : 'disconnected',
        storage_used_mb: t.slug === 'dr-mohamed-noor' ? 120.4 : 14.2
      },
      doctor: {
        name: t.owner_name,
        email: t.owner_email,
        phone: t.owner_phone,
        last_login_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
      }
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      stats: {
        total_clinics: totalClinics,
        active_clinics: activeClinics,
        suspended_clinics: suspendedClinics,
        pending_expiry: pendingExpiry,
        estimated_mrr: estimatedMRR,
        plans: {
          basic: basicCount,
          pro: proCount,
          enterprise: enterpriseCount
        }
      },
      tenants: resolvedTenants
    }
  });
});

// Platform Admin: Suspend/Reactivate Tenant Status
app.put('/admin/v1/tenants/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log(`[Update Tenant Status Request] ID: ${id}, Status: ${status}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (tenant) {
    tenant.status = status;
    
    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      status === 'suspended' ? 'tenant.deactivate' : 'tenant.activate',
      'tenant',
      id,
      { status },
      req
    );

    return res.status(200).json({
      success: true,
      data: tenant
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة المطلوبة غير موجودة في النظام"
      }
    });
  }
});

// Platform Admin: Renew / Extend Subscription
app.put('/admin/v1/tenants/:id/subscription', (req, res) => {
  const { id } = req.params;
  const { months_to_extend, subscription_plan } = req.body;
  console.log(`[Update Tenant Subscription Request] ID: ${id}, Months: ${months_to_extend}, Plan: ${subscription_plan}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (tenant) {
    const oldPlan = tenant.subscription_plan;
    const oldExpiresAt = tenant.expires_at;

    if (subscription_plan) {
      tenant.subscription_plan = subscription_plan;
      const features = getPlanFeatureFlags(subscription_plan);
      tenant.allow_multi_doctor = features.allow_multi_doctor;
      tenant.allow_insurance = features.allow_insurance;
      tenant.allow_refunds = features.allow_refunds;
    }
    if (months_to_extend) {
      const currentExpiry = new Date(tenant.expires_at);
      currentExpiry.setMonth(currentExpiry.getMonth() + parseInt(months_to_extend));
      tenant.expires_at = currentExpiry.toISOString();
    }
    
    const updatedExpiresAt = tenant.expires_at;
    const newPlan = tenant.subscription_plan;

    // Write subscription history
    mockSubscriptionHistory.push({
      id: `sub-hist-${Math.random().toString(36).substring(7)}`,
      tenant_id: id,
      action: months_to_extend && subscription_plan ? 'renewed' : (months_to_extend ? 'extended' : 'upgraded'),
      old_plan: oldPlan,
      new_plan: newPlan,
      old_expires_at: oldExpiresAt,
      new_expires_at: updatedExpiresAt,
      reason: req.body.reason || 'Manual subscription modification',
      changed_by_admin_id: 'admin-uuid-super',
      created_at: new Date().toISOString()
    });

    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      'subscription.change',
      'tenant',
      id,
      { oldPlan, newPlan, oldExpiresAt, newExpiresAt: updatedExpiresAt, months_to_extend },
      req
    );

    return res.status(200).json({
      success: true,
      data: tenant
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة المطلوبة غير موجودة في النظام"
      }
    });
  }
});

// Clinic Staff: Add Secretary
app.post('/v1/staff', (req, res) => {
  const staffData = req.body;
  console.log(`[Add Staff Request] Name: ${staffData.full_name}, Email: ${staffData.email}`);
  
  return res.status(201).json({
    success: true,
    data: {
      staff_id: `staff-uuid-${Math.random().toString(36).substring(7)}`,
      role: "secretary",
      invitation_sent: true
    }
  });
});

// Clinic Staff: Toggle Bot Takeover
app.post('/v1/chats/:conversation_id/toggle-bot', (req, res) => {
  const { conversation_id } = req.params;
  const { manual_mode } = req.body;
  console.log(`[Toggle Bot Takeover] Conversation: ${conversation_id}, Manual Mode: ${manual_mode}`);
  
  return res.status(200).json({
    success: true,
    data: {
      conversation_id: conversation_id,
      bot_active: !manual_mode,
      manual_mode_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    }
  });
});

// Clinic Staff: Consultation (E-Prescription)
app.post('/v1/appointments/:appointment_id/consultation', (req, res) => {
  const { appointment_id } = req.params;
  const data = req.body;
  console.log(`[Save Consultation Request] Appt ID: ${appointment_id}, Diagnosis: ${data.diagnosis_icd11}`);
  
  // Find appointment
  const apt = mockAppointments.find(a => a.id === appointment_id);
  if (!apt) {
    return res.status(404).json({ success: false, error: { message: "الموعد غير موجود" } });
  }
  
  // Mark completed
  apt.status = 'completed';
  
  // Create medical record
  const recordId = `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const prescriptionId = `rx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const pdfUrl = `https://storage.SCS-admin.com/tenant-uuid-noor/prescriptions/rx-2026-${Math.floor(Math.random() * 9000 + 1000)}.pdf`;
  
  const newRecord = {
    id: recordId,
    tenant_id: apt.tenant_id,
    patient_id: apt.patient_id,
    appointment_id: appointment_id,
    doctor_id: apt.doctor_id || "doc-uuid-noor-1",
    subjective: data.subjective || "كشف سريري",
    objective: data.objective || { blood_pressure: "120/80", pulse: 75, temperature: 37, weight: 70 },
    diagnosis_icd11: data.diagnosis_icd11 || "عام",
    plan: data.plan || "",
    prescription_items: data.prescription_items || [],
    created_at: new Date().toISOString()
  };
  
  mockMedicalRecords.push(newRecord);
  
  // If patient is chatbot registered, push to conversation
  const patient = mockPatients.find(p => p.id === apt.patient_id);
  if (apt.patient_id.startsWith('pat-bot-')) {
    const phone = apt.patient_id.replace('pat-bot-', '');
    let conv = mockConversations.find(c => c.patient_id === apt.patient_id);
    if (!conv) {
      conv = {
        id: `conv-bot-${phone}`,
        tenant_id: "tenant-uuid-noor",
        patient_id: apt.patient_id,
        patient_name: patient ? patient.full_name : "مريض جديد",
        channel: "whatsapp",
        bot_active: true,
        unread_count: 0,
        status: "active",
        messages: []
      };
      mockConversations.push(conv);
    }
    
    // Build prescription text list
    const rxList = (data.prescription_items || [])
      .map((item, index) => `${index + 1}. ${item.medication_name} — ${item.dosage} (${item.duration})`)
      .join('\n');
    
    const prescriptionMsg = `📄 روشتة علاجية رقمية جديدة لمريضك: *${patient ? patient.full_name : 'جديد'}*\n\nالتشخيص: ${data.diagnosis_icd11 || 'كشف عام'}\n\nالأدوية الموصوفة:\n${rxList || 'لا يوجد أدوية موصوفة'}\n\nتحميل الروشتة بصيغة PDF:\n${pdfUrl}`;
    
    conv.messages.push({
      id: `msg-${Date.now()}`,
      sender: "bot",
      text: prescriptionMsg,
      timestamp: new Date().toISOString()
    });
    
    conv.last_message = `روشتة علاجية: ${data.diagnosis_icd11 || 'كشف عام'}`;
    conv.last_message_at = new Date().toISOString();
    conv.unread_count += 1;
  }
  
  return res.status(200).json({
    success: true,
    data: {
      medical_record_id: recordId,
      prescription_id: prescriptionId,
      pdf_url: pdfUrl,
      whatsapp_status: "enqueued"
    }
  });
});

// Clinic Staff: Sync Offline Data
app.post('/v1/sync', (req, res) => {
  const { actions } = req.body;
  console.log(`[Offline Sync Request] Received actions: ${actions ? actions.length : 0}`);
  
  return res.status(200).json({
    success: true,
    data: {
      synced_count: actions ? actions.length : 0,
      conflicts: []
    }
  });
});

// Clinic Staff: Call Next Patient
app.post('/v1/queue/call-next', (req, res) => {
  const { doctor_id } = req.body;
  console.log(`[Call Next Patient Request] Doctor: ${doctor_id}`);
  
  return res.status(200).json({
    success: true,
    data: {
      called_patient: {
        queue_number: 14,
        display_name: "محمد أ.",
        appointment_id: "appointment-uuid-called-123"
      },
      websocket_broadcast_sent: true
    }
  });
});

// Clinic Staff: Get Notification Settings
app.get('/v1/settings/notifications', (req, res) => {
  console.log(`[Get Notification Settings Request]`);
  return res.status(200).json({
    success: true,
    data: {
      notification_settings: clinicNotificationSettings
    }
  });
});

// Clinic Staff: Update Notification Settings
app.put('/v1/settings/notifications', (req, res) => {
  const { notification_settings } = req.body;
  console.log(`[Update Notification Settings Request]`, notification_settings);
  
  if (notification_settings) {
    clinicNotificationSettings = { ...clinicNotificationSettings, ...notification_settings };
  }
  
  return res.status(200).json({
    success: true,
    data: {
      message: "تم تحديث إعدادات الإشعارات بنجاح",
      updated_settings: clinicNotificationSettings
    }
  });
});

// Clinic Staff: Get Operational Settings
app.get('/v1/settings/operational', (req, res) => {
  console.log(`[Get Operational Settings Request]`);
  return res.status(200).json({
    success: true,
    data: clinicOperationalSettings
  });
});

// Clinic Staff: Update Operational Settings
app.put('/v1/settings/operational', (req, res) => {
  console.log(`[Update Operational Settings Request]`, req.body);
  clinicOperationalSettings = { ...clinicOperationalSettings, ...req.body };
  return res.status(200).json({
    success: true,
    data: clinicOperationalSettings
  });
});

// Clinic Staff: Get Insurance Companies
app.get('/v1/settings/insurance', (req, res) => {
  console.log(`[Get Insurance Settings Request]`);
  return res.status(200).json({
    success: true,
    data: clinicInsuranceCompanies
  });
});

// Clinic Staff: Add Insurance Company
app.post('/v1/settings/insurance', (req, res) => {
  const { name_ar, name_en, coverage } = req.body;
  console.log(`[Add Insurance Company Request]`, { name_ar, name_en, coverage });
  
  if (!name_ar || !name_en) {
    return res.status(400).json({
      success: false,
      error: { message: "الاسم بالعربية والإنجليزية مطلوب" }
    });
  }

  const newCompany = {
    id: `ins-${Math.random().toString(36).substring(7)}`,
    name_ar,
    name_en,
    active: true,
    coverage: parseInt(coverage) || 80
  };

  clinicInsuranceCompanies.push(newCompany);

  return res.status(200).json({
    success: true,
    data: newCompany
  });
});

// Clinic Staff: Update/Toggle Insurance Company
app.put('/v1/settings/insurance/:id', (req, res) => {
  const { id } = req.params;
  const { active, coverage } = req.body;
  console.log(`[Update Insurance Company Request] ID: ${id}`, { active, coverage });

  const company = clinicInsuranceCompanies.find(c => c.id === id);
  if (!company) {
    return res.status(404).json({
      success: false,
      error: { message: "شركة التأمين غير موجودة" }
    });
  }

  if (active !== undefined) company.active = active;
  if (coverage !== undefined) company.coverage = parseInt(coverage);

  return res.status(200).json({
    success: true,
    data: company
  });
});

// Clinic Staff: Get Clinic Tickets
app.get('/v1/tickets', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || 'tenant-uuid-noor';
  console.log(`[Get Clinic Tickets Request] Tenant ID: ${tenantId}`);
  const tickets = mockTickets.filter(t => t.tenant_id === tenantId);
  return res.status(200).json({
    success: true,
    data: tickets
  });
});

// Clinic Staff: Create New Ticket
app.post('/v1/tickets', (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || 'tenant-uuid-noor';
  const { type, title, description } = req.body;
  console.log(`[Create Clinic Ticket Request] Tenant ID: ${tenantId}`, { type, title, description });

  if (!type || !title || !description) {
    return res.status(400).json({
      success: false,
      error: { message: "يرجى تعبئة كافة الحقول المطلوبة" }
    });
  }

  // Get clinic name
  const clinic = mockTenants.find(t => t.id === tenantId) || { name: 'عيادة غير معروفة' };

  const typeLabels = {
    renew: "تجديد اشتراك",
    upgrade: "ترقية الباقة",
    maintenance: "طلب صيانة",
    complaint: "شكوى أو اقتراح"
  };

  const newTicket = {
    id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
    tenant_id: tenantId,
    tenant_name: clinic.name || clinic.owner_name || 'عيادة غير معروفة',
    type,
    type_ar: typeLabels[type] || type,
    title,
    description,
    status: "pending",
    created_at: new Date().toISOString(),
    response_notes: ""
  };

  mockTickets.push(newTicket);

  return res.status(201).json({
    success: true,
    data: newTicket
  });
});

// Meta WhatsApp Webhook Validation
app.get('/webhooks/whatsapp', (req, res) => {
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

const botStates = {};

// Helper to get reply for a phone number
function handleBotMessage(phone, text, senderName) {
  if (!botStates[phone]) {
    botStates[phone] = { step: 'IDLE', data: {} };
  }

  const state = botStates[phone];
  let cleanedText = text.trim().toLowerCase();
  
  // Extract leading digits to support telegram reply keyboards seamlessly
  const leadingDigitMatch = cleanedText.match(/^(\d+)/);
  if (leadingDigitMatch) {
    cleanedText = leadingDigitMatch[1];
  }

  // ── Triage: Emergency keyword detection (before any state check) ──
  const emergencyKeywords = [
    'ألم شديد', 'انهيار', 'إغماء', 'صعوبة تنفس', 'ضيق تنفس', 'نزيف', 'حادثة',
    'سكتة', 'أزمة قلبية', 'مات', 'ميت', 'حالة طارئة', 'طارئ',
    'لا يتنفس', 'بيتألم جداً', 'تعب جداً جداً', 'فقد الوعي'
  ];
  const isEmergency = emergencyKeywords.some(kw => text.includes(kw));
  if (isEmergency) {
    return {
      reply: `🔴 تنبيه حالة طارئة 🔴\n\nيبدو أن الحالة تستدعي الرعاية الطارئة الفورية.\n\n⚠️ يرجى التوجه فوراً إلى أقرب قسم طوارئ أو الاتصال بالإسعاف:\n📞 123 (إسعاف مصر)\n📞 137 (نجدة الشرطة)\n\nلا تتأخر! هذا البوت مخصص للمواعيد المنتظمة فقط.`
    };
  }

  // Reset triggers
  if (cleanedText === 'البداية' || cleanedText === 'start' || cleanedText === 'البدء') {
    state.step = 'MENU';
    state.data = {};
    return {
      reply: `مرحباً بك في نظام الحجز الذكي لعيادة النور!\n\nيرجى اختيار الرقم المناسب للمتابعة:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم`
    };
  }

  // Helper: get active bookable services (exclude follow-ups with price 0)
  function getBookableServices() {
    return mockServices.filter(s => s.is_active && s.tenant_id === 'tenant-uuid-noor' && s.price > 0);
  }

  // Helper: get today's day name in English lowercase
  function getTodayDayName() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  // Helper: get working hours for a specific doctor and day
  function getDoctorWorkingHoursForToday(doctorId) {
    const todayDay = getTodayDayName();
    if (!db.memoryDB.doctorWorkingHours) db.memoryDB.doctorWorkingHours = {};
    const doctorHours = db.memoryDB.doctorWorkingHours[doctorId] || mockWorkingHours;
    const daySchedule = doctorHours.find(h => h.day === todayDay);
    if (!daySchedule || !daySchedule.is_open || !daySchedule.shifts || daySchedule.shifts.length === 0) {
      return null;
    }
    return daySchedule;
  }

  // Helper: generate available time slots from shifts based on service duration
  function generateTimeSlots(shifts, durationMinutes, doctorId) {
    const slots = [];
    const todayDate = getTodayStr();

    // Get already booked appointments for this doctor today
    const bookedTimes = mockAppointments
      .filter(a => a.doctor_id === doctorId && a.date === todayDate && a.status !== 'cancelled')
      .map(a => a.time);

    shifts.forEach(shift => {
      const [startH, startM] = shift.start.split(':').map(Number);
      const [endH, endM] = shift.end.split(':').map(Number);
      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + durationMinutes <= endMinutes) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // Skip if already booked
        if (!bookedTimes.includes(timeStr)) {
          const period = h < 12 ? 'صباحاً' : (h < 17 ? 'ظهراً' : 'مساءً');
          const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
          slots.push({
            time: timeStr,
            display: `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`,
            location: shift.location || ''
          });
        }
        currentMinutes += durationMinutes;
      }
    });
    return slots;
  }

  // Helper: get clinic doctors
  function getClinicDoctors() {
    return (db.memoryDB.doctors || []).filter(d => d.tenant_id === 'tenant-uuid-noor');
  }

  switch (state.step) {
    case 'IDLE':
      state.step = 'MENU';
      return {
        reply: `مرحباً بك في نظام الحجز الذكي لعيادة النور!\n\nيرجى اختيار الرقم المناسب للمتابعة:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم`
      };

    case 'MENU':
      if (cleanedText === '1') {
        state.step = 'ASK_NAME';
        return {
          reply: `يرجى كتابة اسم المريض بالكامل لتسجيله:`
        };
      } else if (cleanedText === '2') {
        // ── Option 2: Look up active appointments for this phone ──
        const patientId2 = `pat-bot-${phone}`;
        const activeApts = mockAppointments.filter(a =>
          a.patient_id === patientId2 &&
          (a.status === 'confirmed' || a.status === 'checked_in')
        );
        if (activeApts.length === 0) {
          return {
            reply: `لا يوجد حجوزات نشطة حالياً لهذا الرقم.\n\nاكتب "البداية" للعودة للقائمة الرئيسية.`
          };
        }
        const aptDetails = activeApts.map((a, i) =>
          `${i+1}. 📅 ${a.date} الساعة ${a.time}\n   الخدمة: ${a.service_name || 'كشف'}\n   الحالة: ${a.status === 'confirmed' ? 'مؤكد' : 'حضر العيادة'}\n   رقم دورك: [${a.queue_number}]`
        ).join('\n\n');
        return {
          reply: `✅ حجوزاتك النشطة:\n\n${aptDetails}\n\nاكتب "البداية" للعودة للقائمة الرئيسية.`
        };
      } else if (cleanedText === '3') {
        // ── Option 3: Show active appointments to cancel ──
        const patientId3 = `pat-bot-${phone}`;
        const cancelableApts = mockAppointments.filter(a =>
          a.patient_id === patientId3 &&
          (a.status === 'confirmed')
        );
        if (cancelableApts.length === 0) {
          return {
            reply: `لا يوجد مواعيد مؤكدة نشطة لإلغائها.\n\nاكتب "البداية" للعودة للقائمة الرئيسية.`
          };
        }
        state.data.cancelableApts = cancelableApts;
        state.step = 'ASK_CANCEL';
        const aptList = cancelableApts.map((a, i) =>
          `${i+1}. 📅 ${a.date} الساعة ${a.time} — ${a.service_name || 'كشف'}`
        ).join('\n');
        return {
          reply: `اختر رقم الموعد الذي تريد إلغاءه:\n\n${aptList}\n\n0. رجوع`
        };
      } else {
        return {
          reply: `خيارات غير صالحة. يرجى اختيار:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم`
        };
      }

    case 'ASK_NAME':
      state.data.patientName = text;
      // Check if multi-doctor is enabled
      const tenant = mockTenants.find(t => t.id === 'tenant-uuid-noor');
      const doctors = getClinicDoctors();
      if (tenant && tenant.allow_multi_doctor && doctors.length > 1) {
        state.step = 'ASK_DOCTOR';
        state.data.doctors = doctors;
        const docList = doctors.map((d, i) => `${i+1}. ${d.full_name} — ${d.specialty}`).join('\n');
        return {
          reply: `أهلاً بك يا أستاذ ${text}.\nيرجى اختيار الطبيب المعالج:\n${docList}`
        };
      } else {
        // Single doctor — auto-select
        state.data.doctorId = doctors.length > 0 ? doctors[0].id : 'doc-uuid-noor-1';
        state.data.doctorName = doctors.length > 0 ? doctors[0].full_name : 'الطبيب';
        state.step = 'ASK_SERVICE';
        const services = getBookableServices();
        const svcList = services.map((s, i) => `${i+1}. ${s.name} (${s.price} ج.م)`).join('\n');
        state.data.servicesList = services;
        return {
          reply: `أهلاً بك يا أستاذ ${text}.\nيرجى اختيار الخدمة المطلوبة:\n${svcList}`
        };
      }

    case 'ASK_DOCTOR': {
      const docIdx = parseInt(cleanedText) - 1;
      const docList = state.data.doctors || [];
      if (isNaN(docIdx) || docIdx < 0 || docIdx >= docList.length) {
        const reList = docList.map((d, i) => `${i+1}. ${d.full_name} — ${d.specialty}`).join('\n');
        return { reply: `رقم غير صالح. يرجى اختيار:\n${reList}` };
      }
      state.data.doctorId = docList[docIdx].id;
      state.data.doctorName = docList[docIdx].full_name;
      state.step = 'ASK_SERVICE';
      const services = getBookableServices();
      state.data.servicesList = services;
      const svcList = services.map((s, i) => `${i+1}. ${s.name} (${s.price} ج.م)`).join('\n');
      return {
        reply: `تم اختيار ${docList[docIdx].full_name}.\nيرجى اختيار الخدمة المطلوبة:\n${svcList}`
      };
    }

    case 'ASK_SERVICE': {
      const svcIdx = parseInt(cleanedText) - 1;
      const svcList = state.data.servicesList || getBookableServices();
      if (isNaN(svcIdx) || svcIdx < 0 || svcIdx >= svcList.length) {
        const reList = svcList.map((s, i) => `${i+1}. ${s.name} (${s.price} ج.م)`).join('\n');
        return { reply: `خيار غير صالح. يرجى اختيار:\n${reList}` };
      }
      const selectedSvc = svcList[svcIdx];
      state.data.serviceId = selectedSvc.id;
      state.data.serviceName = selectedSvc.name;
      state.data.amount = selectedSvc.price;
      state.data.durationMinutes = selectedSvc.duration_minutes || 20;

      // Get today's working hours for the selected doctor
      const doctorId = state.data.doctorId || 'doc-uuid-noor-1';
      const daySchedule = getDoctorWorkingHoursForToday(doctorId);
      if (!daySchedule) {
        state.step = 'MENU';
        state.data = {};
        return {
          reply: `عذراً، العيادة مغلقة اليوم (${getTodayDayName()}).\nيرجى المحاولة في يوم آخر.\n\nاكتب "البداية" للعودة للقائمة الرئيسية.`
        };
      }

      // Generate available time slots
      const availableSlots = generateTimeSlots(daySchedule.shifts, state.data.durationMinutes, doctorId);
      if (availableSlots.length === 0) {
        state.step = 'MENU';
        state.data = {};
        return {
          reply: `عذراً، لا توجد مواعيد متاحة لهذا اليوم. جميع المواعيد محجوزة.\n\nاكتب "البداية" للعودة للقائمة الرئيسية.`
        };
      }

      state.data.availableSlots = availableSlots;
      state.step = 'ASK_TIME';

      // Show max 8 slots to avoid overwhelming the user
      const displaySlots = availableSlots.slice(0, 8);
      const slotsText = displaySlots.map((s, i) => {
        const locLabel = s.location ? ` — 📍 ${s.location}` : '';
        return `${i+1}. الساعة ${s.display}${locLabel}`;
      }).join('\n');
      const moreText = availableSlots.length > 8 ? `\n\n... و${availableSlots.length - 8} مواعيد أخرى متاحة` : '';
      return {
        reply: `يرجى اختيار موعد الحجز المناسب اليوم:\n${slotsText}${moreText}`
      };
    }

    case 'ASK_TIME': {
      const timeIdx = parseInt(cleanedText) - 1;
      const slots = (state.data.availableSlots || []).slice(0, 8);
      if (isNaN(timeIdx) || timeIdx < 0 || timeIdx >= slots.length) {
        const reSlots = slots.map((s, i) => {
          const locLabel = s.location ? ` — 📍 ${s.location}` : '';
          return `${i+1}. الساعة ${s.display}${locLabel}`;
        }).join('\n');
        return { reply: `رقم غير صالح. يرجى اختيار:\n${reSlots}` };
      }
      const chosenSlot = slots[timeIdx];
      state.data.time = chosenSlot.time;
      state.data.location = chosenSlot.location;

      // Calculate end time
      const [sh, sm] = chosenSlot.time.split(':').map(Number);
      const endMinutes = sh * 60 + sm + (state.data.durationMinutes || 20);
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      state.data.endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      state.step = 'ASK_PAYMENT';
      return {
        reply: `تم اختيار الموعد: ${chosenSlot.display}${chosenSlot.location ? ' — 📍 ' + chosenSlot.location : ''}\n\nاختر طريقة الدفع المناسبة:\n1. نقداً بالعيادة (Cash)\n2. دفع إلكتروني (Visa/Fawry)`
      };
    }

    case 'ASK_PAYMENT': {
      let paymentMethod = '';
      if (cleanedText === '1') {
        paymentMethod = 'cash';
      } else if (cleanedText === '2') {
        paymentMethod = 'online';
      } else {
        return {
          reply: `خيارات غير صالحة. يرجى اختيار:\n1. نقداً بالعيادة (Cash)\n2. دفع إلكتروني (Visa/Fawry)`
        };
      }
      
      // Calculate queue number
      const todayDateForBot = getTodayStr();
      const docIdForBot = state.data.doctorId || 'doc-uuid-noor-1';
      const todayApptsForBot = mockAppointments.filter(a => a.date === todayDateForBot && a.doctor_id === docIdForBot && a.status !== 'cancelled');
      const maxQueueForBot = todayApptsForBot.reduce((max, a) => (a.queue_number && a.queue_number > max) ? a.queue_number : max, 0);
      const nextQueueNum = maxQueueForBot + 1;
      const apptId = `apt-bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Save appointment with real data
      const newApt = {
        id: apptId,
        tenant_id: "tenant-uuid-noor",
        patient_id: `pat-bot-${phone}`,
        doctor_id: state.data.doctorId || "doc-uuid-noor-1",
        service_id: state.data.serviceId || "svc-001",
        service_name: state.data.serviceName,
        date: getTodayStr(),
        time: state.data.time,
        end_time: state.data.endTime || state.data.time,
        status: "confirmed",
        visit_type: "exam",
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'online' ? 'paid' : 'pending',
        amount: state.data.amount,
        queue_number: nextQueueNum,
        notes: "حجز تلقائي عبر الواتساب",
        booking_code: `BK-BOT-${nextQueueNum}`,
        created_at: new Date().toISOString()
      };
      
      mockAppointments.push(newApt);

      // Register patient in mockPatients if not present
      const patientId = `pat-bot-${phone}`;
      if (!mockPatients.find(p => p.id === patientId)) {
        mockPatients.push({
          id: patientId,
          tenant_id: "tenant-uuid-noor",
          phone: `+${phone}`,
          full_name: state.data.patientName,
          first_name: state.data.patientName.split(' ')[0] || 'مريض',
          last_name: state.data.patientName.split(' ').slice(1).join(' ') || 'جديد',
          age: 30,
          gender: "male",
          email: `${phone}@bot.com`,
          blood_type: "A+",
          allergies: "لا يوجد",
          chronic_conditions: "لا يوجد",
          source: "whatsapp_bot",
          tags: ["Bot"],
          total_visits: 1,
          last_visit_at: new Date().toISOString(),
          total_paid: paymentMethod === 'online' ? state.data.amount : 0,
          created_at: new Date().toISOString()
        });
      }
      
      // Push to waiting list in currentQueueState
      currentQueueState.waiting_list.push({
        queue_number: nextQueueNum,
        patient_name: state.data.patientName,
        appointment_id: apptId
      });

      const locationInfo = state.data.location ? `\n- الفرع: 📍 ${state.data.location}` : '';
      const doctorInfo = state.data.doctorName ? `\n- الطبيب: ${state.data.doctorName}` : '';
      
      state.step = 'COMPLETED';
      return {
        reply: `🎉 تم تأكيد حجزك بنجاح يا أستاذ ${state.data.patientName}!\n\nتفاصيل الحجز:${doctorInfo}\n- الخدمة: ${state.data.serviceName}\n- الموعد: اليوم الساعة ${state.data.time}\n- القيمة: ${state.data.amount} ج.م\n- طريقة الدفع: ${paymentMethod === 'online' ? 'دفع إلكتروني' : 'نقداً بالعيادة'}\n- رقم دورك في طابور الانتظار: [ ${nextQueueNum} ]${locationInfo}\n\nيرجى الحضور في الموعد المحدد. يومك سعيد!`
      };
    }

    case 'ASK_CANCEL': {
      if (cleanedText === '0') {
        state.step = 'MENU';
        state.data = {};
        return { reply: `تم الرجوع للقائمة الرئيسية:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم` };
      }
      const idx = parseInt(cleanedText) - 1;
      const cancelable = state.data.cancelableApts || [];
      if (isNaN(idx) || idx < 0 || idx >= cancelable.length) {
        return { reply: `رقم غير صالح. يرجى اختيار رقم من القائمة أو اكتب 0 للرجوع.` };
      }
      const aptToCancel = cancelable[idx];
      // Mark as cancelled in mockAppointments
      const aptRecord = mockAppointments.find(a => a.id === aptToCancel.id);
      if (aptRecord) aptRecord.status = 'cancelled';
      state.step = 'MENU';
      state.data = {};
      return {
        reply: `✅ تم إلغاء موعدك بنجاح!\n\nتفاصيل الموعد الملغي:\n📅 ${aptToCancel.date} الساعة ${aptToCancel.time}\n\nنأمل أن نراك مجدداً. اكتب "البداية" للعودة للقائمة أو لحجز موعد آخر.`
      };
    }

    case 'COMPLETED':
      state.step = 'MENU';
      state.data = {};
      return {
        reply: `مرحباً بك مجدداً! يرجى اختيار الرقم المناسب للمتابعة:\n1. حجز موعد جديد\n2. الاستعلام عن موعد\n3. إلغاء حجز قائم`
      };

    default:
      state.step = 'IDLE';
      return { reply: `عذراً، حدث خطأ. يرجى كتابة "البداية" للبدء من جديد.` };
  }
}

// Meta WhatsApp Webhook Event Receiver
app.post('/webhooks/whatsapp', (req, res) => {
  console.log(`[WhatsApp Webhook Message Received]`, JSON.stringify(req.body, null, 2));
  
  const entry = req.body.entry && req.body.entry[0];
  const changes = entry && entry.changes && entry.changes[0];
  const value = changes && changes.value;
  const message = value && value.messages && value.messages[0];
  const contact = value && value.contacts && value.contacts[0];

  if (message) {
    const fromNumber = message.from;
    const text = message.text ? message.text.body : '';
    const name = contact && contact.profile ? contact.profile.name : 'مريض';

    const botResponse = handleBotMessage(fromNumber, text, name);
    return res.status(200).json({ success: true, reply: botResponse.reply });
  }

  return res.status(200).json({ success: true });
});

// Telegram Webhook Event Receiver
app.post('/webhooks/telegram', (req, res) => {
  console.log(`[Telegram Webhook Message Received]`, JSON.stringify(req.body, null, 2));
  const message = req.body.message;
  if (message) {
    const fromNumber = message.from.id.toString();
    const text = message.text || '';
    const name = message.from.first_name || 'مريض';

    const botResponse = handleBotMessage(fromNumber, text, name);
    return res.status(200).json({ success: true, reply: botResponse.reply });
  }
  return res.status(200).json({ success: true });
});

// Debug endpoints for Bot Simulator
app.get('/webhooks/payments/bot-state', (req, res) => {
  const phone = req.query.phone;
  const state = botStates[phone] ? botStates[phone].step : 'IDLE';
  return res.json({ success: true, state });
});

app.post('/webhooks/payments/reset-state', (req, res) => {
  const phone = req.body.phone;
  if (phone) {
    botStates[phone] = { step: 'IDLE', data: {} };
  }
  return res.json({ success: true });
});

app.post('/webhooks/payments/seed-visit', (req, res) => {
  return res.json({ success: true });
});

// Bot Simulator: Get inbox messages for a phone number (for prescription delivery polling)
app.get('/bot/inbox/:phone', (req, res) => {
  const phone = req.params.phone.replace('+', '');
  const patientId = `pat-bot-${phone}`;
  const conv = mockConversations.find(c => c.patient_id === patientId);
  if (!conv) {
    return res.json({ success: true, messages: [] });
  }
  return res.json({ success: true, messages: conv.messages, unread_count: conv.unread_count });
});

// Platform Admin: Get Single Tenant details
app.get('/admin/v1/tenants/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[Get Tenant Details Request] ID: ${id}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (tenant) {
    return res.status(200).json({
      success: true,
      data: {
        tenant: {
          ...tenant,
          usage_stats: {
            total_patients: tenant.slug === 'dr-mohamed-noor' ? 142 : 12,
            total_appointments: tenant.slug === 'dr-mohamed-noor' ? 450 : 25,
            whatsapp_connection: tenant.slug === 'dr-mohamed-noor' ? 'connected' : 'disconnected',
            storage_used_mb: tenant.slug === 'dr-mohamed-noor' ? 120.4 : 14.2
          }
        },
        owner: {
          email: tenant.owner_email || `${tenant.slug}-owner@domain.com`,
          phone: tenant.owner_phone || "+201012345678",
          full_name: tenant.owner_name || `د. مالك عيادة ${tenant.name}`
        }
      }
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة المطلوبة غير موجودة في النظام"
      }
    });
  }
});

// Platform Admin: Update Tenant details
app.put('/admin/v1/tenants/:id', (req, res) => {
  const { id } = req.params;
  const { name, specialty, subscription_plan, email, phone } = req.body;
  console.log(`[Update Tenant Details Request] ID: ${id}, Name: ${name}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (tenant) {
    if (name) tenant.name = name;
    if (specialty) tenant.specialty = specialty;
    if (subscription_plan) tenant.subscription_plan = subscription_plan;
    if (email) tenant.owner_email = email.toLowerCase();
    if (phone) tenant.owner_phone = phone;
    
    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      'tenant.update',
      'tenant',
      id,
      { name, specialty, subscription_plan, email, phone },
      req
    );

    return res.status(200).json({
      success: true,
      data: {
        tenant,
        owner: {
          email: tenant.owner_email,
          phone: tenant.owner_phone
        }
      }
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة غير موجودة في النظام"
      }
    });
  }
});

// Platform Admin: Delete Tenant
app.delete('/admin/v1/tenants/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[Delete Tenant Request] ID: ${id}`);

  const tenantIndex = mockTenants.findIndex(t => t.id === id);
  if (tenantIndex !== -1) {
    const tenant = mockTenants[tenantIndex];
    const now = new Date();
    const expiry = new Date(tenant.expires_at);
    
    if (tenant.status === 'active' && expiry > now) {
      return res.status(400).json({
        success: false,
        error: {
          code: "ACTIVE_SUBSCRIPTION",
          message: "لا يمكن حذف عيادة باشتراك نشط. يرجى تعليق الاشتراك أولاً."
        }
      });
    }

    mockTenants.splice(tenantIndex, 1);

    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      'tenant.delete',
      'tenant',
      id,
      { name: tenant.name },
      req
    );

    return res.status(200).json({
      success: true,
      message: "تم حذف العيادة بنجاح"
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة غير موجودة في النظام"
      }
    });
  }
});

// Platform Admin: Override Feature Flags manually
app.put('/admin/v1/tenants/:id/features', (req, res) => {
  const { id } = req.params;
  const { allow_multi_doctor, allow_insurance, allow_refunds } = req.body;
  console.log(`[Update Feature Flags Request] ID: ${id}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (tenant) {
    if (allow_multi_doctor !== undefined) tenant.allow_multi_doctor = allow_multi_doctor;
    if (allow_insurance !== undefined) tenant.allow_insurance = allow_insurance;
    if (allow_refunds !== undefined) tenant.allow_refunds = allow_refunds;

    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      'tenant.update_features',
      'tenant',
      id,
      { allow_multi_doctor, allow_insurance, allow_refunds },
      req
    );

    return res.status(200).json({
      success: true,
      data: tenant
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة غير موجودة في النظام"
      }
    });
  }
});

// Platform Admin: Reset Doctor Password Simulator
app.post('/admin/v1/tenants/:id/reset-password', (req, res) => {
  const { id } = req.params;
  console.log(`[Reset Doctor Password Request] Tenant ID: ${id}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (tenant) {
    const resetToken = `rst_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const resetLink = `https://www.SCS-admin.com/reset-password?token=${resetToken}`;

    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      'user.password_reset',
      'user',
      id,
      { clinicName: tenant.name, ownerEmail: tenant.owner_email },
      req
    );

    console.log(`\n==========================================`);
    console.log(`📧 [Ops Password Reset Link Alert] To: ${tenant.owner_email}`);
    console.log(`🔗 Reset Link: ${resetLink}`);
    console.log(`==========================================\n`);

    return res.status(200).json({
      success: true,
      message: "تم توليد رابط إعادة تعيين كلمة المرور بنجاح وإرساله بريدياً للطبيب",
      data: {
        reset_link: resetLink
      }
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "TENANT_NOT_FOUND",
        message: "العيادة غير موجودة في النظام"
      }
    });
  }
});

// Platform Admin: Get Audit Logs
app.get('/admin/v1/audit-logs', (req, res) => {
  console.log(`[Get Audit Logs Request]`);
  const resolvedLogs = mockAdminAuditLogs.map(l => ({
    ...l,
    operator_name: "أحمد مشغل النظام"
  }));
  return res.status(200).json({
    success: true,
    data: resolvedLogs
  });
});

// Platform Admin: Get Subscription History
app.get('/admin/v1/tenants/:id/subscription-history', (req, res) => {
  const { id } = req.params;
  console.log(`[Get Subscription History Request] Tenant ID: ${id}`);
  
  const history = mockSubscriptionHistory.filter(h => h.tenant_id === id);
  const resolvedHistory = history.map(h => ({
    ...h,
    operator_name: "أحمد مشغل النظام"
  }));

  return res.status(200).json({
    success: true,
    data: resolvedHistory
  });
});

// Platform Admin: Get Tenant Doctors
app.get('/admin/v1/tenants/:id/doctors', (req, res) => {
  const { id } = req.params;
  console.log(`[Get Doctors Request] Tenant ID: ${id}`);
  
  if (!db.memoryDB.doctors) db.memoryDB.doctors = [];
  const docs = db.memoryDB.doctors.filter(d => d.tenant_id === id);
  return res.status(200).json({
    success: true,
    data: docs
  });
});

// Platform Admin: Add Doctor to Tenant
app.post('/admin/v1/tenants/:id/doctors', (req, res) => {
  const { id } = req.params;
  const { full_name, specialty } = req.body;
  console.log(`[Add Doctor Request] Tenant ID: ${id}, Name: ${full_name}`);

  const tenant = mockTenants.find(t => t.id === id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: { code: "TENANT_NOT_FOUND", message: "العيادة غير موجودة في النظام" }
    });
  }

  // Count current doctors in this tenant
  if (!db.memoryDB.doctors) db.memoryDB.doctors = [];
  const doctorsCount = db.memoryDB.doctors.filter(d => d.tenant_id === id).length;

  if (!tenant.allow_multi_doctor && doctorsCount >= 1) {
    return res.status(403).json({
      success: false,
      error: {
        code: "MULTI_DOCTOR_DISABLED",
        message: "الخطة الحالية للعيادة لا تدعم إضافة أكثر من طبيب واحد. يرجى ترقية باقة الاشتراك لـ Pro أو Enterprise أولاً لتفعيل ميزة الأطباء المتعددين."
      }
    });
  }

  const docId = `doc-${Math.random().toString(36).substring(7)}`;
  const newDoctor = {
    id: docId,
    tenant_id: id,
    full_name,
    specialty: specialty || 'عمومي'
  };
  
  db.memoryDB.doctors.push(newDoctor);

  // Write audit log
  logAdminAction(
    'admin-uuid-super',
    'tenant.add_doctor',
    'tenant',
    id,
    { doctorName: full_name, specialty },
    req
  );

  return res.status(201).json({
    success: true,
    message: "تم إضافة الطبيب بنجاح للعيادة",
    data: newDoctor
  });
});

// Platform Admin: Get Plans Config
app.get('/admin/v1/plans', (req, res) => {
  console.log(`[Get Plans Config Request]`);
  return res.status(200).json({
    success: true,
    data: mockPlans
  });
});

// Platform Admin: Update/Create Plan Config
app.put('/admin/v1/plans/:id', (req, res) => {
  const { id } = req.params;
  const planData = req.body;
  console.log(`[Update/Create Plan Config Request] ID: ${id}`);
  
  let plan = mockPlans.find(p => p.id === id);
  const isNew = !plan;
  
  if (isNew) {
    plan = {
      id: id,
      name: planData.name || (id.charAt(0).toUpperCase() + id.slice(1))
    };
    mockPlans.push(plan);
    console.log(`[Create Plan Request] Created plan ID: ${id}`);
  }
  
  if (planData.price_usd !== undefined) plan.price_usd = planData.price_usd;
  if (planData.price_egp !== undefined) plan.price_egp = planData.price_egp;
  if (planData.allow_multi_doctor !== undefined) plan.allow_multi_doctor = planData.allow_multi_doctor;
  if (planData.allow_insurance !== undefined) plan.allow_insurance = planData.allow_insurance;
  if (planData.allow_refunds !== undefined) plan.allow_refunds = planData.allow_refunds;
  if (planData.allow_whatsapp !== undefined) plan.allow_whatsapp = planData.allow_whatsapp;
  if (planData.allow_telegram !== undefined) plan.allow_telegram = planData.allow_telegram;
  if (planData.allow_analytics !== undefined) plan.allow_analytics = planData.allow_analytics;
  if (planData.allow_voice_bot !== undefined) plan.allow_voice_bot = planData.allow_voice_bot;
  if (planData.allow_custom_branding !== undefined) plan.allow_custom_branding = planData.allow_custom_branding;
  
  // Write audit log
  logAdminAction(
    'admin-uuid-super',
    isNew ? 'plan.create' : 'plan.update_config',
    'plan',
    id,
    { price_usd: plan.price_usd, price_egp: plan.price_egp },
    req
  );

  return res.status(200).json({
    success: true,
    data: plan
  });
});

// Platform Admin: Delete Plan Config
app.delete('/admin/v1/plans/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[Delete Plan Request] ID: ${id}`);

  // check if there are clinics on this plan
  const planInUse = mockTenants.some(t => t.subscription_plan.toLowerCase() === id.toLowerCase());
  if (planInUse) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PLAN_IN_USE",
        message: "لا يمكن حذف هذه الباقة لوجود اشتراكات نشطة عليها حالياً."
      }
    });
  }

  const planIndex = mockPlans.findIndex(p => p.id === id);
  if (planIndex !== -1) {
    const deletedPlan = mockPlans[planIndex];
    mockPlans.splice(planIndex, 1);

    // Write audit log
    logAdminAction(
      'admin-uuid-super',
      'plan.delete',
      'plan',
      id,
      { name: deletedPlan.name },
      req
    );

    return res.status(200).json({
      success: true,
      message: "تم حذف الباقة بنجاح"
    });
  } else {
    return res.status(404).json({
      success: false,
      error: {
        code: "PLAN_NOT_FOUND",
        message: "الباقة غير موجودة في النظام"
      }
    });
  }
});

// =============================================
// CLINIC DASHBOARD SYSTEM — Mock Data & APIs
// =============================================

// --- Mock Patients ---
const mockPatients = [
  { id: "pat-001", tenant_id: "tenant-uuid-noor", phone: "+201098765432", full_name: "أحمد محمد حسن", first_name: "أحمد", last_name: "حسن", age: 32, gender: "male", email: "ahmed@example.com", blood_type: "A+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: ["VIP"], total_visits: 5, last_visit_at: "2026-07-02T10:00:00Z", total_paid: 2500, created_at: "2026-01-15T08:00:00Z" },
  { id: "pat-002", tenant_id: "tenant-uuid-noor", phone: "+201112223344", full_name: "سارة علي إبراهيم", first_name: "سارة", last_name: "إبراهيم", age: 28, gender: "female", email: "sara@example.com", blood_type: "B+", allergies: "بنسلين", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 3, last_visit_at: "2026-06-28T14:00:00Z", total_paid: 1500, created_at: "2026-02-10T09:00:00Z" },
  { id: "pat-003", tenant_id: "tenant-uuid-noor", phone: "+201055566677", full_name: "محمود سعيد عبد الله", first_name: "محمود", last_name: "عبد الله", age: 45, gender: "male", email: null, blood_type: "O+", allergies: "لا يوجد", chronic_conditions: "ضغط دم مرتفع", source: "whatsapp_bot", tags: [], total_visits: 8, last_visit_at: "2026-07-01T09:00:00Z", total_paid: 4000, created_at: "2025-11-20T10:00:00Z" },
  { id: "pat-004", tenant_id: "tenant-uuid-noor", phone: "+201199988877", full_name: "هالة عبد الرحمن محمد", first_name: "هالة", last_name: "محمد", age: 35, gender: "female", email: "hala@example.com", blood_type: "AB+", allergies: "أسبرين", chronic_conditions: "سكري نوع 2", source: "whatsapp_bot", tags: ["متابعة"], total_visits: 12, last_visit_at: "2026-07-03T11:00:00Z", total_paid: 6000, created_at: "2025-06-01T08:00:00Z" },
  { id: "pat-005", tenant_id: "tenant-uuid-noor", phone: "+201033344455", full_name: "كريم أحمد مصطفى", first_name: "كريم", last_name: "مصطفى", age: 22, gender: "male", email: null, blood_type: "A-", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 1, last_visit_at: "2026-06-15T16:00:00Z", total_paid: 500, created_at: "2026-06-15T15:00:00Z" },
  { id: "pat-006", tenant_id: "tenant-uuid-noor", phone: "+201277788899", full_name: "فاطمة حسين علي", first_name: "فاطمة", last_name: "علي", age: 50, gender: "female", email: "fatma@example.com", blood_type: "O-", allergies: "مضادات الالتهاب", chronic_conditions: "روماتيزم", source: "whatsapp_bot", tags: ["VIP"], total_visits: 15, last_visit_at: "2026-07-04T08:30:00Z", total_paid: 7500, created_at: "2025-03-10T07:00:00Z" },
  { id: "pat-007", tenant_id: "tenant-uuid-noor", phone: "+201066677788", full_name: "عمر خالد يوسف", first_name: "عمر", last_name: "يوسف", age: 18, gender: "male", email: null, blood_type: "B-", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: [], total_visits: 2, last_visit_at: "2026-06-20T13:00:00Z", total_paid: 1000, created_at: "2026-05-01T11:00:00Z" },
  { id: "pat-008", tenant_id: "tenant-uuid-noor", phone: "+201144455566", full_name: "نورهان محمد سيد", first_name: "نورهان", last_name: "سيد", age: 30, gender: "female", email: "nourhan@example.com", blood_type: "A+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 4, last_visit_at: "2026-06-25T10:00:00Z", total_paid: 2000, created_at: "2026-01-01T09:00:00Z" },
  { id: "pat-009", tenant_id: "tenant-uuid-noor", phone: "+201088899900", full_name: "يوسف إبراهيم أحمد", first_name: "يوسف", last_name: "أحمد", age: 40, gender: "male", email: null, blood_type: "AB-", allergies: "لا يوجد", chronic_conditions: "حساسية موسمية", source: "whatsapp_bot", tags: [], total_visits: 6, last_visit_at: "2026-07-02T15:00:00Z", total_paid: 3000, created_at: "2025-09-15T08:00:00Z" },
  { id: "pat-010", tenant_id: "tenant-uuid-noor", phone: "+201255566677", full_name: "مريم عادل حسن", first_name: "مريم", last_name: "حسن", age: 26, gender: "female", email: "mariam@example.com", blood_type: "O+", allergies: "لاتكس", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: ["VIP"], total_visits: 7, last_visit_at: "2026-07-03T09:00:00Z", total_paid: 3500, created_at: "2025-08-01T10:00:00Z" },
  { id: "pat-011", tenant_id: "tenant-uuid-noor", phone: "+201177788800", full_name: "علي حسام الدين", first_name: "علي", last_name: "الدين", age: 55, gender: "male", email: null, blood_type: "B+", allergies: "سلفا", chronic_conditions: "ضغط + سكري", source: "manual", tags: ["متابعة"], total_visits: 20, last_visit_at: "2026-07-04T10:00:00Z", total_paid: 10000, created_at: "2024-12-01T08:00:00Z" },
  { id: "pat-012", tenant_id: "tenant-uuid-noor", phone: "+201044455500", full_name: "ريم السيد محمد", first_name: "ريم", last_name: "محمد", age: 33, gender: "female", email: "reem@example.com", blood_type: "A+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: [], total_visits: 2, last_visit_at: "2026-06-10T14:00:00Z", total_paid: 1000, created_at: "2026-04-20T09:00:00Z" },
  { id: "pat-013", tenant_id: "tenant-uuid-noor", phone: "+201299900011", full_name: "حسن محمود عبد العزيز", first_name: "حسن", last_name: "عبد العزيز", age: 42, gender: "male", email: null, blood_type: "O+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: [], total_visits: 3, last_visit_at: "2026-06-30T11:00:00Z", total_paid: 1500, created_at: "2026-03-01T08:00:00Z" },
  { id: "pat-014", tenant_id: "tenant-uuid-noor", phone: "+201166677700", full_name: "دينا أشرف سالم", first_name: "دينا", last_name: "سالم", age: 29, gender: "female", email: "dina@example.com", blood_type: "B+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "manual", tags: [], total_visits: 1, last_visit_at: null, total_paid: 0, created_at: "2026-07-03T16:00:00Z" },
  { id: "pat-015", tenant_id: "tenant-uuid-noor", phone: "+201055500011", full_name: "طارق عبد الفتاح", first_name: "طارق", last_name: "عبد الفتاح", age: 60, gender: "male", email: null, blood_type: "A+", allergies: "بنسلين", chronic_conditions: "قلب", source: "whatsapp_bot", tags: ["VIP", "متابعة"], total_visits: 25, last_visit_at: "2026-07-04T09:00:00Z", total_paid: 12500, created_at: "2024-06-01T07:00:00Z" },
  { id: "pat-016", tenant_id: "tenant-uuid-noor", phone: "+201288800099", full_name: "ياسمين خالد نور", first_name: "ياسمين", last_name: "نور", age: 24, gender: "female", email: "yasmin@example.com", blood_type: "AB+", allergies: "لا يوجد", chronic_conditions: "لا يوجد", source: "whatsapp_bot", tags: [], total_visits: 2, last_visit_at: "2026-07-01T12:00:00Z", total_paid: 1000, created_at: "2026-05-15T10:00:00Z" }
];

// --- Mock Services ---
const mockServices = [
  { id: "svc-001", tenant_id: "tenant-uuid-noor", name: "كشف عام", name_en: "General Exam", price: 500, duration_minutes: 20, category: "exam", is_active: true },
  { id: "svc-002", tenant_id: "tenant-uuid-noor", name: "متابعة مجانية", name_en: "Free Follow-up", price: 0, duration_minutes: 15, category: "followup", is_active: true },
  { id: "svc-003", tenant_id: "tenant-uuid-noor", name: "تنظيف أسنان", name_en: "Teeth Cleaning", price: 800, duration_minutes: 30, category: "procedure", is_active: true },
  { id: "svc-004", tenant_id: "tenant-uuid-noor", name: "حشو عصب", name_en: "Root Canal", price: 2500, duration_minutes: 60, category: "procedure", is_active: true },
  { id: "svc-005", tenant_id: "tenant-uuid-noor", name: "خلع ضرس", name_en: "Tooth Extraction", price: 600, duration_minutes: 30, category: "procedure", is_active: true },
  { id: "svc-006", tenant_id: "tenant-uuid-noor", name: "تبييض أسنان", name_en: "Teeth Whitening", price: 3000, duration_minutes: 45, category: "cosmetic", is_active: true },
  { id: "svc-007", tenant_id: "tenant-uuid-noor", name: "تركيب تقويم", name_en: "Braces Installation", price: 15000, duration_minutes: 90, category: "procedure", is_active: true },
  { id: "svc-008", tenant_id: "tenant-uuid-noor", name: "حشو تجميلي", name_en: "Cosmetic Filling", price: 1200, duration_minutes: 30, category: "procedure", is_active: true }
];

// --- Mock Working Hours ---
const mockWorkingHours = [
  { day: "sunday", day_ar: "الأحد", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "monday", day_ar: "الإثنين", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "tuesday", day_ar: "الثلاثاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "wednesday", day_ar: "الأربعاء", is_open: true, shifts: [{ start: "09:00", end: "14:00", location: "فرع الدقي" }, { start: "17:00", end: "21:00", location: "فرع التجمع" }] },
  { day: "thursday", day_ar: "الخميس", is_open: true, shifts: [{ start: "09:00", end: "15:00", location: "فرع مصر الجديدة" }] },
  { day: "friday", day_ar: "الجمعة", is_open: false, shifts: [] },
  { day: "saturday", day_ar: "السبت", is_open: true, shifts: [{ start: "10:00", end: "14:00", location: "فرع الدقي" }] }
];

// --- Today's date helper ---
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const getRelativeDateStr = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const todayStr = getTodayStr();
const yesterdayStr = getRelativeDateStr(-1);
const tomorrowStr = getRelativeDateStr(1);
const futureStr = getRelativeDateStr(3);

// --- Mock Appointments ---
const mockAppointments = [
  // Today's appointments
  { id: "apt-001", tenant_id: "tenant-uuid-noor", patient_id: "pat-006", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "09:00", end_time: "09:20", status: "completed", visit_type: "exam", payment_method: "cash", payment_status: "paid", amount: 500, queue_number: 1, notes: "", booking_code: "BK-7001", created_at: "2026-07-03T20:00:00Z" },
  { id: "apt-002", tenant_id: "tenant-uuid-noor", patient_id: "pat-015", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "09:30", end_time: "09:50", status: "completed", visit_type: "exam", payment_method: "online", payment_status: "paid", amount: 450, queue_number: 2, notes: "خصم دفع أونلاين", booking_code: "BK-7002", created_at: "2026-07-03T18:00:00Z" },
  { id: "apt-003", tenant_id: "tenant-uuid-noor", patient_id: "pat-011", doctor_id: "doc-uuid-noor-1", service_id: "svc-003", date: todayStr, time: "10:00", end_time: "10:30", status: "checked_in", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 800, queue_number: 3, notes: "", booking_code: "BK-7003", created_at: "2026-07-02T14:00:00Z" },
  { id: "apt-004", tenant_id: "tenant-uuid-noor", patient_id: "pat-004", doctor_id: "doc-uuid-noor-1", service_id: "svc-002", date: todayStr, time: "10:30", end_time: "10:45", status: "checked_in", visit_type: "followup", payment_method: "none", payment_status: "free", amount: 0, queue_number: 4, notes: "متابعة بعد حشو عصب", booking_code: "BK-7004", created_at: "2026-07-03T10:00:00Z" },
  { id: "apt-005", tenant_id: "tenant-uuid-noor", patient_id: "pat-001", doctor_id: "doc-uuid-noor-1", service_id: "svc-004", date: todayStr, time: "11:00", end_time: "12:00", status: "confirmed", visit_type: "exam", payment_method: "online", payment_status: "paid", amount: 2250, queue_number: 5, notes: "حشو عصب ضرس سفلي", booking_code: "BK-7005", created_at: "2026-07-01T09:00:00Z" },
  { id: "apt-006", tenant_id: "tenant-uuid-noor", patient_id: "pat-010", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "11:30", end_time: "11:50", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 6, notes: "", booking_code: "BK-7006", created_at: "2026-07-02T16:00:00Z" },
  { id: "apt-007", tenant_id: "tenant-uuid-noor", patient_id: "pat-002", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "12:00", end_time: "12:20", status: "confirmed", visit_type: "exam", payment_method: "insurance", payment_status: "pending_approval", amount: 500, queue_number: 7, notes: "تأمين طبي — AXA", booking_code: "BK-7007", created_at: "2026-07-03T11:00:00Z" },
  { id: "apt-008", tenant_id: "tenant-uuid-noor", patient_id: "pat-009", doctor_id: "doc-uuid-noor-1", service_id: "svc-005", date: todayStr, time: "17:00", end_time: "17:30", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 600, queue_number: 8, notes: "", booking_code: "BK-7008", created_at: "2026-07-03T22:00:00Z" },
  { id: "apt-009", tenant_id: "tenant-uuid-noor", patient_id: "pat-016", doctor_id: "doc-uuid-noor-1", service_id: "svc-006", date: todayStr, time: "17:30", end_time: "18:15", status: "confirmed", visit_type: "exam", payment_method: "online", payment_status: "paid", amount: 2700, queue_number: 9, notes: "جلسة تبييض", booking_code: "BK-7009", created_at: "2026-07-02T20:00:00Z" },
  { id: "apt-010", tenant_id: "tenant-uuid-noor", patient_id: "pat-007", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "18:30", end_time: "18:50", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 10, notes: "", booking_code: "BK-7010", created_at: "2026-07-04T06:00:00Z" },
  { id: "apt-011", tenant_id: "tenant-uuid-noor", patient_id: "pat-003", doctor_id: "doc-uuid-noor-1", service_id: "svc-008", date: todayStr, time: "19:00", end_time: "19:30", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 1200, queue_number: 11, notes: "حشو تجميلي أمامي", booking_code: "BK-7011", created_at: "2026-07-03T15:00:00Z" },
  { id: "apt-012", tenant_id: "tenant-uuid-noor", patient_id: "pat-005", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: todayStr, time: "19:30", end_time: "19:50", status: "no_show", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 12, notes: "", booking_code: "BK-7012", created_at: "2026-07-01T14:00:00Z" },
  // Yesterday's appointments
  { id: "apt-013", tenant_id: "tenant-uuid-noor", patient_id: "pat-004", doctor_id: "doc-uuid-noor-1", service_id: "svc-004", date: yesterdayStr, time: "10:00", end_time: "11:00", status: "completed", visit_type: "exam", payment_method: "cash", payment_status: "paid", amount: 2500, queue_number: 1, notes: "حشو عصب ضرس 36", booking_code: "BK-6901", created_at: "2026-07-01T08:00:00Z" },
  { id: "apt-014", tenant_id: "tenant-uuid-noor", patient_id: "pat-010", doctor_id: "doc-uuid-noor-1", service_id: "svc-003", date: yesterdayStr, time: "11:00", end_time: "11:30", status: "completed", visit_type: "exam", payment_method: "online", payment_status: "paid", amount: 720, queue_number: 2, notes: "", booking_code: "BK-6902", created_at: "2026-06-30T12:00:00Z" },
  { id: "apt-015", tenant_id: "tenant-uuid-noor", patient_id: "pat-008", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: yesterdayStr, time: "12:00", end_time: "12:20", status: "completed", visit_type: "exam", payment_method: "cash", payment_status: "paid", amount: 500, queue_number: 3, notes: "", booking_code: "BK-6903", created_at: "2026-07-02T09:00:00Z" },
  { id: "apt-016", tenant_id: "tenant-uuid-noor", patient_id: "pat-012", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: yesterdayStr, time: "17:00", end_time: "17:20", status: "no_show", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 4, notes: "", booking_code: "BK-6904", created_at: "2026-07-01T20:00:00Z" },
  // Tomorrow's appointments
  { id: "apt-017", tenant_id: "tenant-uuid-noor", patient_id: "pat-013", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: tomorrowStr, time: "09:00", end_time: "09:20", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 1, notes: "", booking_code: "BK-7101", created_at: "2026-07-04T10:00:00Z" },
  { id: "apt-018", tenant_id: "tenant-uuid-noor", patient_id: "pat-001", doctor_id: "doc-uuid-noor-1", service_id: "svc-002", date: tomorrowStr, time: "10:00", end_time: "10:15", status: "confirmed", visit_type: "followup", payment_method: "none", payment_status: "free", amount: 0, queue_number: 2, notes: "متابعة بعد حشو عصب", booking_code: "BK-7102", created_at: "2026-07-04T08:00:00Z" },
  { id: "apt-019", tenant_id: "tenant-uuid-noor", patient_id: "pat-006", doctor_id: "doc-uuid-noor-1", service_id: "svc-007", date: tomorrowStr, time: "11:00", end_time: "12:30", status: "confirmed", visit_type: "exam", payment_method: "online", payment_status: "paid", amount: 13500, queue_number: 3, notes: "تركيب تقويم", booking_code: "BK-7103", created_at: "2026-07-03T16:00:00Z" },
  // A week from now
  { id: "apt-020", tenant_id: "tenant-uuid-noor", patient_id: "pat-014", doctor_id: "doc-uuid-noor-1", service_id: "svc-001", date: futureStr, time: "09:00", end_time: "09:20", status: "confirmed", visit_type: "exam", payment_method: "cash", payment_status: "pending", amount: 500, queue_number: 1, notes: "أول زيارة", booking_code: "BK-7201", created_at: "2026-07-04T12:00:00Z" },
  { id: "apt-021", tenant_id: "tenant-uuid-noor", patient_id: "pat-011", doctor_id: "doc-uuid-noor-1", service_id: "svc-002", date: futureStr, time: "10:00", end_time: "10:15", status: "confirmed", visit_type: "followup", payment_method: "none", payment_status: "free", amount: 0, queue_number: 2, notes: "", booking_code: "BK-7202", created_at: "2026-07-04T11:00:00Z" }
];

// --- Mock Medical Records ---
const mockMedicalRecords = [
  { id: "rec-001", tenant_id: "tenant-uuid-noor", patient_id: "pat-006", appointment_id: "apt-001", doctor_id: "doc-uuid-noor-1", subjective: "ألم في الضرس العلوي الأيسر منذ أسبوع يزداد مع المشروبات الباردة", objective: { blood_pressure: "120/80", pulse: 72, temperature: 37.0, weight: 68 }, diagnosis_icd11: "DA01.1 - Dental caries extending into dentine", plan: "حشو تجميلي للضرس 26 + مسكن ألم لمدة 3 أيام", prescription_items: [{ medication_name: "Ibuprofen 400mg", dosage: "قرص كل 8 ساعات بعد الأكل", duration: "3 أيام" }, { medication_name: "Chlorhexidine Mouthwash", dosage: "مضمضة مرتين يومياً", duration: "أسبوع" }], created_at: "2026-07-04T09:20:00Z" },
  { id: "rec-002", tenant_id: "tenant-uuid-noor", patient_id: "pat-015", appointment_id: "apt-002", doctor_id: "doc-uuid-noor-1", subjective: "كشف دوري - لا يوجد شكوى حالية", objective: { blood_pressure: "130/85", pulse: 78, temperature: 36.8, weight: 82 }, diagnosis_icd11: "DA00.0 - Dental caries (no symptoms)", plan: "تنظيف أسنان في الزيارة القادمة + متابعة تسوس ضرس 16", prescription_items: [], created_at: "2026-07-04T09:50:00Z" },
  { id: "rec-003", tenant_id: "tenant-uuid-noor", patient_id: "pat-004", appointment_id: "apt-013", doctor_id: "doc-uuid-noor-1", subjective: "ألم شديد في الضرس السفلي الأيمن - حساسية للحرارة واللمس", objective: { blood_pressure: "115/75", pulse: 80, temperature: 36.9, weight: 55 }, diagnosis_icd11: "DA01.2 - Dental caries extending into pulp", plan: "حشو عصب ضرس 36 (جلسة أولى) + مضاد حيوي", prescription_items: [{ medication_name: "Amoxicillin 500mg", dosage: "كبسولة كل 8 ساعات", duration: "5 أيام" }, { medication_name: "Paracetamol 500mg", dosage: "قرص عند الحاجة", duration: "3 أيام" }], created_at: "2026-07-03T11:00:00Z" }
];

// --- Mock Conversations (Inbox) ---
const mockConversations = [
  { id: "conv-001", tenant_id: "tenant-uuid-noor", patient_id: "pat-001", patient_name: "أحمد محمد", channel: "whatsapp", bot_active: true, last_message: "تمام عايز أحجز مع الدكتور", last_message_at: "2026-07-04T12:30:00Z", unread_count: 2, status: "active", messages: [
    { id: "msg-001", sender: "patient", text: "السلام عليكم", timestamp: "2026-07-04T12:25:00Z" },
    { id: "msg-002", sender: "bot", text: "مرحباً أستاذ أحمد! كيف يمكننا مساعدتك اليوم؟\n1. حجز موعد جديد\n2. تعديل أو إلغاء حجز\n3. التحدث مع السكرتارية", timestamp: "2026-07-04T12:25:05Z" },
    { id: "msg-003", sender: "patient", text: "تمام عايز أحجز مع الدكتور", timestamp: "2026-07-04T12:30:00Z" }
  ]},
  { id: "conv-002", tenant_id: "tenant-uuid-noor", patient_id: "pat-002", patient_name: "سارة علي", channel: "whatsapp", bot_active: false, last_message: "المواعيد دي مش مناسبة لي، في مواعيد مسائية؟", last_message_at: "2026-07-04T12:15:00Z", unread_count: 1, status: "manual_mode", messages: [
    { id: "msg-004", sender: "patient", text: "عايزة أحجز كشف أسنان", timestamp: "2026-07-04T12:00:00Z" },
    { id: "msg-005", sender: "bot", text: "يرجى اختيار الميعاد المناسب:\n1. الأربعاء 10:00 صباحاً\n2. الخميس 11:30 صباحاً", timestamp: "2026-07-04T12:00:10Z" },
    { id: "msg-006", sender: "patient", text: "المواعيد دي مش مناسبة لي، في مواعيد مسائية؟", timestamp: "2026-07-04T12:15:00Z" }
  ]},
  { id: "conv-003", tenant_id: "tenant-uuid-noor", patient_id: "pat-003", patient_name: "محمود سعيد", channel: "telegram", bot_active: true, last_message: "تم تأكيد الدفع بنجاح ✅", last_message_at: "2026-07-04T11:00:00Z", unread_count: 0, status: "resolved", messages: [
    { id: "msg-007", sender: "patient", text: "عايز أحجز حشو تجميلي", timestamp: "2026-07-04T10:30:00Z" },
    { id: "msg-008", sender: "bot", text: "تم حجز موعد حشو تجميلي يوم الجمعة الساعة 7 مساءً.\nسعر الخدمة: 1200 جنيه\nادفع أونلاين واحصل على خصم 10%!", timestamp: "2026-07-04T10:35:00Z" },
    { id: "msg-009", sender: "patient", text: "هدفع أونلاين", timestamp: "2026-07-04T10:40:00Z" },
    { id: "msg-010", sender: "bot", text: "تم تأكيد الدفع بنجاح ✅\nكود الحجز: BK-7011\nموقع العيادة: https://maps.google.com/...", timestamp: "2026-07-04T11:00:00Z" }
  ]},
  { id: "conv-004", tenant_id: "tenant-uuid-noor", patient_id: "pat-008", patient_name: "نورهان محمد", channel: "whatsapp", bot_active: true, last_message: "سعر جلسة التبييض كام؟", last_message_at: "2026-07-04T13:00:00Z", unread_count: 1, status: "active", messages: [
    { id: "msg-011", sender: "patient", text: "سعر جلسة التبييض كام؟", timestamp: "2026-07-04T13:00:00Z" }
  ]}
];

// --- Queue State ---
let currentQueueState = {
  current_in_exam: { queue_number: 3, patient_name: "علي حسام", appointment_id: "apt-003", doctor_name: "د. محمد نور" },
  waiting_list: [
    { queue_number: 4, patient_name: "هالة عبد الرحمن", appointment_id: "apt-004" },
    { queue_number: 5, patient_name: "أحمد محمد", appointment_id: "apt-005" },
    { queue_number: 6, patient_name: "مريم عادل", appointment_id: "apt-006" },
    { queue_number: 7, patient_name: "سارة علي", appointment_id: "apt-007" },
    { queue_number: 8, patient_name: "يوسف إبراهيم", appointment_id: "apt-008" },
    { queue_number: 9, patient_name: "ياسمين خالد", appointment_id: "apt-009" },
    { queue_number: 10, patient_name: "عمر خالد", appointment_id: "apt-010" },
    { queue_number: 11, patient_name: "محمود سعيد", appointment_id: "apt-011" },
    { queue_number: 12, patient_name: "فاطمة الزهراء", appointment_id: "apt-012" },
    { queue_number: 13, patient_name: "مصطفى محمود", appointment_id: "apt-013" },
    { queue_number: 14, patient_name: "هدى عبد العزيز", appointment_id: "apt-014" },
    { queue_number: 15, patient_name: "خالد وليد", appointment_id: "apt-015" },
    { queue_number: 16, patient_name: "رانيا يوسف", appointment_id: "apt-016" },
    { queue_number: 17, patient_name: "عبد الرحمن أحمد", appointment_id: "apt-017" },
    { queue_number: 18, patient_name: "نهى شريف", appointment_id: "apt-018" },
    { queue_number: 19, patient_name: "كريم عبد العزيز", appointment_id: "apt-019" },
    { queue_number: 20, patient_name: "مي عمر", appointment_id: "apt-020" }
  ],
  last_called_at: ""
};

// =============================================
// CLINIC DASHBOARD API ROUTES
// =============================================

// --- Dashboard Stats ---
app.get('/v1/dashboard/stats', (req, res) => {
  const today = getTodayStr();
  const todayAppts = mockAppointments.filter(a => a.date === today);
  const completed = todayAppts.filter(a => a.status === 'completed');
  const checkedIn = todayAppts.filter(a => a.status === 'checked_in');
  const confirmed = todayAppts.filter(a => a.status === 'confirmed');
  const noShows = todayAppts.filter(a => a.status === 'no_show');
  const totalRevenue = todayAppts.filter(a => a.payment_status === 'paid').reduce((sum, a) => sum + a.amount, 0);
  const onlineRevenue = todayAppts.filter(a => a.payment_status === 'paid' && a.payment_method === 'online').reduce((sum, a) => sum + a.amount, 0);
  const cashRevenue = todayAppts.filter(a => a.payment_status === 'paid' && a.payment_method === 'cash').reduce((sum, a) => sum + a.amount, 0);

  return res.json({
    success: true,
    data: {
      today_date: today,
      patients_today: todayAppts.length,
      completed_count: completed.length,
      checked_in_count: checkedIn.length,
      confirmed_count: confirmed.length,
      no_show_count: noShows.length,
      attendance_rate: todayAppts.length > 0 ? Math.round(((completed.length + checkedIn.length) / (completed.length + checkedIn.length + noShows.length || 1)) * 100) : 0,
      total_revenue: totalRevenue,
      online_revenue: onlineRevenue,
      cash_revenue: cashRevenue,
      new_patients_today: 1,
      total_patients: mockPatients.length,
      pending_approvals: todayAppts.filter(a => a.payment_status === 'pending_approval').length,
      active_conversations: mockConversations.filter(c => c.status === 'active' || c.status === 'manual_mode').length,
      tenant_name: "عيادة النور لطب الأسنان",
      allow_multi_doctor: mockTenants.find(t => t.id === "tenant-uuid-noor")?.allow_multi_doctor || false,
      allow_insurance: mockTenants.find(t => t.id === "tenant-uuid-noor")?.allow_insurance || false,
      allow_refunds: mockTenants.find(t => t.id === "tenant-uuid-noor")?.allow_refunds || false
    }
  });
});

// --- Patients API ---
app.get('/v1/patients', (req, res) => {
  const { search, tag, page = 1, limit = 20 } = req.query;
  let filtered = [...mockPatients];

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p => p.full_name.toLowerCase().includes(s) || p.phone.includes(s) || (p.email && p.email.toLowerCase().includes(s)));
  }
  if (tag) {
    filtered = filtered.filter(p => p.tags.includes(tag));
  }

  const start = (parseInt(page) - 1) * parseInt(limit);
  const paginated = filtered.slice(start, start + parseInt(limit));

  return res.json({
    success: true,
    data: {
      patients: paginated,
      total: filtered.length,
      page: parseInt(page),
      total_pages: Math.ceil(filtered.length / parseInt(limit))
    }
  });
});

app.get('/v1/patients/:id', (req, res) => {
  const patient = mockPatients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: { code: "PATIENT_NOT_FOUND", message: "المريض غير موجود" } });

  const appointments = mockAppointments.filter(a => a.patient_id === patient.id).map(a => {
    const svc = mockServices.find(s => s.id === a.service_id);
    return { ...a, service_name: svc ? svc.name : 'غير محدد' };
  });
  const records = mockMedicalRecords.filter(r => r.patient_id === patient.id);

  return res.json({
    success: true,
    data: { patient, appointments, medical_records: records }
  });
});

app.post('/v1/patients', (req, res) => {
  const { full_name, phone, age, gender, email } = req.body;
  const names = full_name.split(' ');
  const newPatient = {
    id: `pat-${Math.random().toString(36).substring(7)}`,
    tenant_id: "tenant-uuid-noor",
    phone, full_name,
    first_name: names[0] || full_name,
    last_name: names.length > 1 ? names[names.length - 1] : '',
    age: parseInt(age) || null, gender: gender || null,
    email: email || null, blood_type: null, allergies: null,
    chronic_conditions: null, source: "manual", tags: [],
    total_visits: 0, last_visit_at: null, total_paid: 0,
    created_at: new Date().toISOString()
  };
  mockPatients.push(newPatient);
  return res.status(201).json({ success: true, data: newPatient });
});

app.put('/v1/patients/:id', (req, res) => {
  const patient = mockPatients.find(p => p.id === req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: { code: "PATIENT_NOT_FOUND", message: "المريض غير موجود" } });
  Object.assign(patient, req.body);
  return res.json({ success: true, data: patient });
});

// --- Appointments API ---
app.get('/v1/appointments', (req, res) => {
  const { date, date_from, date_to, status, doctor_id } = req.query;
  let filtered = [...mockAppointments];

  if (date) filtered = filtered.filter(a => a.date === date);
  if (date_from) filtered = filtered.filter(a => a.date >= date_from);
  if (date_to) filtered = filtered.filter(a => a.date <= date_to);
  if (status) filtered = filtered.filter(a => a.status === status);
  if (doctor_id) filtered = filtered.filter(a => a.doctor_id === doctor_id);

  // Enrich with patient and service data
  const enriched = filtered.map(a => {
    const patient = mockPatients.find(p => p.id === a.patient_id);
    const service = mockServices.find(s => s.id === a.service_id);
    return {
      ...a,
      patient_name: patient ? patient.full_name : 'غير معروف',
      patient_phone: patient ? patient.phone : '',
      patient_gender: patient ? patient.gender : '',
      patient_age: patient ? patient.age : null,
      service_name: service ? service.name : 'غير محدد',
      service_duration: service ? service.duration_minutes : 20
    };
  });

  return res.json({ success: true, data: enriched });
});

app.get('/v1/appointments/:id', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
  const patient = mockPatients.find(p => p.id === apt.patient_id);
  const service = mockServices.find(s => s.id === apt.service_id);
  return res.json({ success: true, data: { ...apt, patient, service } });
});

app.post('/v1/appointments', (req, res) => {
  const { patient_id, doctor_id, service_id, date, time, visit_type, payment_method, notes, location } = req.body;
  const targetDoctorId = doctor_id || "doc-uuid-noor-1";
  const service = mockServices.find(s => s.id === service_id);
  
  // Calculate end_time
  const endTime = service ? (() => { 
    const [h, m] = time.split(':').map(Number); 
    const end = new Date(2026, 0, 1, h, m + service.duration_minutes); 
    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`; 
  })() : (() => {
    const [h, m] = time.split(':').map(Number); 
    const end = new Date(2026, 0, 1, h, m + 20); // Default 20 mins
    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  })();

  // Overlap validation
  const [startH, startM] = time.split(':').map(Number);
  const newStartMin = startH * 60 + startM;
  const [endH, endM] = endTime.split(':').map(Number);
  const newEndMin = endH * 60 + endM;

  const conflicts = mockAppointments.filter(a => 
    a.date === date && 
    a.doctor_id === targetDoctorId && 
    a.status !== 'cancelled'
  );

  for (const apt of conflicts) {
    const [aptStartH, aptStartM] = apt.time.split(':').map(Number);
    const aptStartMin = aptStartH * 60 + aptStartM;
    const [aptEndH, aptEndM] = (apt.end_time || apt.time).split(':').map(Number);
    const aptEndMin = aptEndH * 60 + aptEndM;

    // Check overlap: new start is before existing end AND new end is after existing start
    if (newStartMin < aptEndMin && newEndMin > aptStartMin) {
      return res.status(400).json({ 
        success: false, 
        error: { message: "⚠️ تنبيه: هذا الوقت محجوز بالفعل لدى الطبيب، يرجى اختيار فترة أخرى." } 
      });
    }
  }

  const todayAppts = mockAppointments.filter(a => a.date === date && a.doctor_id === targetDoctorId && a.status !== 'cancelled');
  const maxQueue = todayAppts.reduce((max, a) => (a.queue_number && a.queue_number > max) ? a.queue_number : max, 0);
  const newQueueNum = maxQueue + 1;

  const newApt = {
    id: `apt-${Math.random().toString(36).substring(7)}`,
    tenant_id: "tenant-uuid-noor",
    patient_id, 
    doctor_id: targetDoctorId,
    service_id: service_id || "svc-001",
    date, 
    time,
    end_time: endTime,
    status: "confirmed",
    visit_type: visit_type || "exam",
    payment_method: payment_method || "cash",
    payment_status: payment_method === 'online' ? 'paid' : (visit_type === 'followup' ? 'free' : 'pending'),
    amount: service ? (payment_method === 'online' ? Math.round(service.price * 0.9) : service.price) : 500,
    queue_number: newQueueNum,
    notes: notes || '',
    location: location || '',
    booking_code: `BK-${Math.floor(Math.random() * 9000 + 1000)}`,
    created_at: new Date().toISOString()
  };
  mockAppointments.push(newApt);
  return res.status(201).json({ success: true, data: newApt });
});

app.put('/v1/appointments/:id', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
  Object.assign(apt, req.body);
  return res.json({ success: true, data: apt });
});

app.put('/v1/appointments/:id/status', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.id);
  if (!apt) return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
  const { status } = req.body;
  apt.status = status;
  if (status === 'completed' && apt.payment_method === 'cash') apt.payment_status = 'paid';
  console.log(`[Appointment Status Update] ${apt.id} -> ${status}`);
  return res.json({ success: true, data: apt });
});

app.delete('/v1/appointments/:id', (req, res) => {
  const idx = mockAppointments.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
  mockAppointments[idx].status = 'cancelled';
  return res.json({ success: true, data: mockAppointments[idx] });
});

// --- Queue API ---
app.get('/v1/queue/today', (req, res) => {
  return res.json({ success: true, data: currentQueueState });
});

app.post('/v1/queue/check-in/:appointmentId', (req, res) => {
  const apt = mockAppointments.find(a => a.id === req.params.appointmentId);
  if (!apt) return res.status(404).json({ success: false, error: { code: "APPOINTMENT_NOT_FOUND", message: "الموعد غير موجود" } });
  apt.status = 'checked_in';
  console.log(`[Check-In] Patient for appointment ${apt.id} checked in (Queue #${apt.queue_number})`);
  return res.json({ success: true, data: apt });
});

// Override existing call-next with richer response
app.post('/v1/queue/call-next-patient', (req, res) => {
  if (currentQueueState.waiting_list.length === 0) {
    return res.json({ success: true, data: { message: "لا يوجد مرضى في قائمة الانتظار", called_patient: null } });
  }
  const next = currentQueueState.waiting_list.shift();
  currentQueueState.current_in_exam = { ...next, doctor_name: "د. محمد نور" };
  currentQueueState.last_called_at = new Date().toISOString();
  console.log(`[Queue] Called next: ${next.patient_name} (Queue #${next.queue_number})`);
  return res.json({ success: true, data: { called_patient: next, current_in_exam: currentQueueState.current_in_exam, remaining: currentQueueState.waiting_list.length, websocket_broadcast_sent: true } });
});

// --- Services API ---
app.get('/v1/settings/services', (req, res) => {
  return res.json({ success: true, data: mockServices });
});

app.post('/v1/settings/services', (req, res) => {
  const { name, name_en, price, duration_minutes, category } = req.body;
  const newService = {
    id: `svc-${Math.random().toString(36).substring(7)}`,
    tenant_id: "tenant-uuid-noor",
    name, name_en: name_en || '',
    price: parseFloat(price) || 0,
    duration_minutes: parseInt(duration_minutes) || 20,
    category: category || 'exam',
    is_active: true
  };
  mockServices.push(newService);
  return res.status(201).json({ success: true, data: newService });
});

app.put('/v1/settings/services/:id', (req, res) => {
  const svc = mockServices.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ success: false, error: { message: "الخدمة غير موجودة" } });
  Object.assign(svc, req.body);
  return res.json({ success: true, data: svc });
});

// --- Working Hours API ---
app.get('/v1/settings/working-hours', (req, res) => {
  const { doctor_id } = req.query;
  if (doctor_id) {
    if (!db.memoryDB.doctorWorkingHours) db.memoryDB.doctorWorkingHours = {};
    if (!db.memoryDB.doctorWorkingHours[doctor_id]) {
      // Clone default mockWorkingHours
      let customHours = JSON.parse(JSON.stringify(mockWorkingHours));
      // Modify for other doctors to look visually distinct on dropdown change
      if (doctor_id !== "doc-uuid-noor-1") {
        customHours.forEach(h => {
          if (h.day === 'tuesday' || h.day === 'thursday') {
            h.is_open = false;
            h.shifts = [];
          } else if (h.day === 'sunday' && h.shifts.length > 0) {
            h.shifts[0].start = "10:00";
            h.shifts[0].end = "16:00";
          }
        });
      }
      db.memoryDB.doctorWorkingHours[doctor_id] = customHours;
    }
    return res.json({ success: true, data: db.memoryDB.doctorWorkingHours[doctor_id] });
  }
  return res.json({ success: true, data: mockWorkingHours });
});

app.put('/v1/settings/working-hours', (req, res) => {
  const { doctor_id } = req.query;
  const { working_hours } = req.body;
  
  if (doctor_id) {
    if (!db.memoryDB.doctorWorkingHours) db.memoryDB.doctorWorkingHours = {};
    if (working_hours && Array.isArray(working_hours)) {
      db.memoryDB.doctorWorkingHours[doctor_id] = working_hours;
    }
    return res.json({ success: true, data: db.memoryDB.doctorWorkingHours[doctor_id] });
  }
  
  if (working_hours && Array.isArray(working_hours)) {
    working_hours.forEach(wh => {
      const existing = mockWorkingHours.find(h => h.day === wh.day);
      if (existing) Object.assign(existing, wh);
    });
  }
  return res.json({ success: true, data: mockWorkingHours });
});

// --- Medical Records API ---
app.get('/v1/patients/:id/medical-records', (req, res) => {
  const records = mockMedicalRecords.filter(r => r.patient_id === req.params.id);
  return res.json({ success: true, data: records });
});

// --- Conversations / Inbox API ---
app.get('/v1/inbox/conversations', (req, res) => {
  console.log(`[Get Inbox Conversations]`);
  const mapped = mockConversations.map(c => {
    return {
      ...c,
      messages: c.messages.map(m => ({
        ...m,
        body: m.body || m.text
      }))
    };
  });
  return res.json({ success: true, data: mapped });
});

app.post('/v1/inbox/conversations/:id/read', (req, res) => {
  console.log(`[Mark Conversation Read] ID: ${req.params.id}`);
  const conv = mockConversations.find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } });
  conv.unread_count = 0;
  const mapped = {
    ...conv,
    messages: conv.messages.map(m => ({ ...m, body: m.body || m.text }))
  };
  return res.json({ success: true, data: mapped });
});

app.post('/v1/inbox/conversations/:id/messages', (req, res) => {
  console.log(`[Send Message to Conversation] ID: ${req.params.id}`, req.body);
  const conv = mockConversations.find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } });
  const { body } = req.body;
  const newMsg = {
    id: `msg-${Math.random().toString(36).substring(7)}`,
    sender: "secretary",
    body: body,
    text: body,
    timestamp: new Date().toISOString()
  };
  conv.messages.push(newMsg);
  conv.last_message = body;
  conv.last_message_at = newMsg.timestamp;
  conv.bot_active = false;
  conv.status = 'manual_mode';
  return res.json({ success: true, data: { ...conv, messages: conv.messages.map(m => ({ ...m, body: m.body || m.text })) } });
});

app.post('/v1/inbox/conversations/:id/bot', (req, res) => {
  console.log(`[Toggle Bot Active status] ID: ${req.params.id}`, req.body);
  const conv = mockConversations.find(c => c.id === req.params.id);
  if (!conv) return res.status(404).json({ success: false, error: { message: "المحادثة غير موجودة" } });
  const { active } = req.body;
  conv.bot_active = !!active;
  conv.status = active ? 'active' : 'manual_mode';
  return res.json({ success: true, data: { bot_active: conv.bot_active, status: conv.status } });
});

// --- Doctors list (clinic-facing) ---
app.get('/v1/doctors', (req, res) => {
  const docs = db.memoryDB.doctors.filter(d => d.tenant_id === "tenant-uuid-noor");
  return res.json({ success: true, data: docs });
});

// --- Add Doctor (clinic-facing) ---
app.post('/v1/doctors', (req, res) => {
  const { full_name, specialty } = req.body;
  if (!full_name || !specialty) {
    return res.status(400).json({ success: false, error: { message: "يرجى إدخال اسم الطبيب وتخصصه" } });
  }

  // Check if tenant has allow_multi_doctor enabled
  const tenant = mockTenants.find(t => t.id === "tenant-uuid-noor");
  if (!tenant) {
    return res.status(404).json({ success: false, error: { message: "العيادة غير موجودة" } });
  }

  const doctorsCount = db.memoryDB.doctors.filter(d => d.tenant_id === "tenant-uuid-noor").length;
  if (!tenant.allow_multi_doctor && doctorsCount >= 1) {
    return res.status(400).json({
      success: false,
      error: {
        code: "MULTI_DOCTOR_LOCKED",
        message: "صلاحية الأطباء المتعددين غير مفعلة لباقة اشتراكك الحالية. يرجى الترقية لتفعيلها."
      }
    });
  }

  const newDoctor = {
    id: `doc-${Math.random().toString(36).substring(7)}`,
    tenant_id: "tenant-uuid-noor",
    full_name,
    specialty,
    created_at: new Date().toISOString()
  };
  
  db.memoryDB.doctors.push(newDoctor);

  return res.json({ success: true, data: newDoctor });
});

// --- Prescription Settings ---
app.get('/v1/settings/prescription', (req, res) => {
  console.log(`[Get Prescription Settings Request]`);
  return res.json({ success: true, data: clinicPrescriptionSettings });
});

app.put('/v1/settings/prescription', (req, res) => {
  console.log(`[Update Prescription Settings Request]`);
  clinicPrescriptionSettings = { ...clinicPrescriptionSettings, ...req.body };
  return res.json({ success: true, data: clinicPrescriptionSettings });
});

// --- Refund Settings ---
app.get('/v1/settings/refund', (req, res) => {
  console.log(`[Get Refund Settings Request]`);
  return res.json({ success: true, data: clinicRefundSettings });
});

app.put('/v1/settings/refund', (req, res) => {
  console.log(`[Update Refund Settings Request]`);
  clinicRefundSettings = { ...clinicRefundSettings, ...req.body };
  return res.json({ success: true, data: clinicRefundSettings });
});

// --- Channel Integration Settings ---
app.get('/v1/settings/channels', (req, res) => {
  console.log(`[Get Channel Settings Request]`);
  // Mask tokens for security in response
  const masked = JSON.parse(JSON.stringify(clinicChannelSettings));
  if (masked.whatsapp.access_token) {
    masked.whatsapp.access_token_masked = '••••' + masked.whatsapp.access_token.slice(-4);
  }
  if (masked.telegram.bot_token) {
    masked.telegram.bot_token_masked = '••••' + masked.telegram.bot_token.slice(-4);
  }
  // Still send real tokens for the mock (in production, never do this)
  return res.json({ success: true, data: clinicChannelSettings });
});

app.put('/v1/settings/channels/whatsapp', (req, res) => {
  console.log(`[Update WhatsApp Channel Settings]`, req.body);
  clinicChannelSettings.whatsapp = {
    ...clinicChannelSettings.whatsapp,
    ...req.body,
    webhook_url: clinicChannelSettings.whatsapp.webhook_url,
    verify_token: clinicChannelSettings.whatsapp.verify_token
  };
  saveSettingsToDisk();
  return res.json({ success: true, data: clinicChannelSettings.whatsapp });
});

app.put('/v1/settings/channels/telegram', (req, res) => {
  console.log(`[Update Telegram Channel Settings]`, req.body);
  clinicChannelSettings.telegram = {
    ...clinicChannelSettings.telegram,
    ...req.body,
    webhook_url: clinicChannelSettings.telegram.webhook_url
  };
  startTelegramPolling();
  saveSettingsToDisk();
  return res.json({ success: true, data: clinicChannelSettings.telegram });
});

app.put('/v1/settings/channels/doctor', (req, res) => {
  console.log(`[Doctor Update Channel Switches & Greeting]`, req.body);
  clinicChannelSettings.bot_greeting = req.body.bot_greeting || clinicChannelSettings.bot_greeting;
  clinicChannelSettings.whatsapp.enabled = !!req.body.whatsapp_enabled;
  clinicChannelSettings.telegram.enabled = !!req.body.telegram_enabled;
  saveSettingsToDisk();
  return res.json({
    success: true,
    data: {
      bot_greeting: clinicChannelSettings.bot_greeting,
      whatsapp_enabled: clinicChannelSettings.whatsapp.enabled,
      telegram_enabled: clinicChannelSettings.telegram.enabled
    }
  });
});

app.post('/v1/settings/channels/whatsapp/test', (req, res) => {
  console.log(`[Test WhatsApp Connection]`);
  const wa = clinicChannelSettings.whatsapp;
  if (!wa.phone_number_id || !wa.access_token) {
    return res.status(400).json({ success: false, error: { message: 'يرجى إدخال بيانات اعتماد واتساب أولاً (Phone Number ID و Access Token)' } });
  }
  // Simulate successful connection test
  clinicChannelSettings.whatsapp.status = 'connected';
  clinicChannelSettings.whatsapp.enabled = true;
  clinicChannelSettings.whatsapp.last_tested_at = new Date().toISOString();
  saveSettingsToDisk();
  return res.json({
    success: true,
    data: {
      status: 'connected',
      message: '✅ تم الاتصال بنجاح بحساب واتساب الأعمال! البوت جاهز لاستقبال الرسائل.',
      phone_display: '+20 10 xxxx ' + wa.phone_number_id.slice(-4)
    }
  });
});

app.post('/v1/settings/channels/telegram/test', (req, res) => {
  console.log(`[Test Telegram Connection]`);
  const tg = clinicChannelSettings.telegram;
  if (!tg.bot_token) {
    return res.status(400).json({ success: false, error: { message: 'يرجى إدخال Bot Token أولاً' } });
  }
  // Simulate setWebhook + getMe
  clinicChannelSettings.telegram.status = 'connected';
  clinicChannelSettings.telegram.enabled = true;
  clinicChannelSettings.telegram.last_tested_at = new Date().toISOString();
  const botUsername = tg.bot_username || 'SmartClinicBot';
  clinicChannelSettings.telegram.bot_username = botUsername;
  startTelegramPolling();
  saveSettingsToDisk();
  return res.json({
    success: true,
    data: {
      status: 'connected',
      message: `✅ تم ربط بوت تليجرام @${botUsername} بنجاح! الـ Webhook تم تعيينه تلقائياً.`,
      bot_link: `https://t.me/${botUsername}`
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: "SERVER_ERROR",
      message: "حدث خطأ داخلي في الخادم المحاكي"
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Smart Clinic OS Mock API Server is running on port ${PORT}`);
  console.log(`📖 Swagger API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`======================================================\n`);
  startTelegramPolling();
});
