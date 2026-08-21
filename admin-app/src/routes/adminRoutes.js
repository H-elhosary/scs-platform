const express = require('express');
const db = require('../db/connection');
const { authenticateToken, requireOperator, requireAdminRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Apply auth middleware to all admin routes
router.use('/admin/v1', authenticateToken, requireOperator);

// Helper: fetch a plan row from the real `plans` table, case-insensitively.
const getPlanRow = async (plan) => {
  if (!plan) return null;
  try {
    return await db.get('SELECT * FROM plans WHERE LOWER(id) = ?', [plan.toLowerCase()]);
  } catch (e) {
    return null;
  }
};

// Helper: Calculate estimated MRR based on subscription plan (DB-backed, with the
// original hardcoded values kept as a fallback for plan ids outside the seeded catalog)
const getPlanMRR = async (plan) => {
  const p = plan.toLowerCase();
  const row = await getPlanRow(p);
  if (row) return row.price_usd;

  switch (p) {
    case 'basic': return 50;     // $50 / month
    case 'pro': return 100;      // $100 / month
    case 'enterprise': return 250; // $250 / month
    default: return 0;
  }
};

// Helper: Get feature flags based on subscription plan (DB-backed, same fallback pattern)
const getPlanFeatureFlags = async (plan) => {
  const p = plan.toLowerCase();
  const row = await getPlanRow(p);
  if (row) {
    return {
      allow_multi_doctor: !!row.allow_multi_doctor,
      allow_insurance: !!row.allow_insurance,
      allow_refunds: !!row.allow_refunds,
      allow_whatsapp: !!row.allow_whatsapp,
      allow_telegram: !!row.allow_telegram,
      allow_analytics: !!row.allow_analytics,
      allow_voice_bot: !!row.allow_voice_bot,
      allow_custom_branding: !!row.allow_custom_branding
    };
  }
  return {
    allow_multi_doctor: p === 'pro' || p === 'enterprise',
    allow_insurance: p === 'enterprise',
    allow_refunds: p === 'enterprise',
    allow_whatsapp: p === 'pro' || p === 'enterprise',
    allow_telegram: p === 'enterprise',
    allow_analytics: p === 'pro' || p === 'enterprise',
    allow_voice_bot: p === 'enterprise',
    allow_custom_branding: p === 'enterprise'
  };
};

// Helper: Log admin actions to audit logs
const logAdminAction = async (adminId, action, targetType, targetId, details, req) => {
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

  if (db.isMock) {
    if (!db.memoryDB.admin_audit_logs) {
      db.memoryDB.admin_audit_logs = [];
    }
    db.memoryDB.admin_audit_logs.push(logEntry);
  } else {
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [logEntry.admin_id, logEntry.action, logEntry.target_type, logEntry.target_id, logEntry.details, logEntry.ip_address, logEntry.user_agent]
      );
    } catch (err) {
      console.error('Failed to log admin action to DB:', err);
    }
  }
};

// Helper: real per-tenant usage numbers (patients/appointments/doctors counted
// from the actual tables, WhatsApp connectivity from real conversation rows).
// Replaces the previous hardcoded-by-slug demo numbers.
async function computeTenantUsageStats(tenantId) {
  const [patRow, apptRow, docRow, waRow] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM patients WHERE tenant_id = ?', [tenantId]),
    db.get('SELECT COUNT(*) as count FROM appointments WHERE tenant_id = ?', [tenantId]),
    db.get(`SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND (role = 'doctor' OR role = 'owner')`, [tenantId]),
    db.get(`SELECT COUNT(*) as count FROM conversations WHERE tenant_id = ? AND channel = 'whatsapp'`, [tenantId])
  ]);
  return {
    total_patients: patRow?.count || 0,
    total_appointments: apptRow?.count || 0,
    doctor_count: docRow?.count || 0,
    whatsapp_connection: (waRow?.count || 0) > 0 ? 'connected' : 'disconnected'
  };
}

/**
 * GET /admin/v1/tenants
 * Fetch all tenants and overall platform analytics
 */
router.get('/admin/v1/tenants', async (req, res) => {
  try {
    let tenantsList = [];
    
    try {
      const rows = await db.all(`
        SELECT t.*, u.full_name as owner_name, u.email as owner_email, u.phone as owner_phone 
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
        ORDER BY t.created_at DESC
      `);
      tenantsList = rows || [];
    } catch (dbErr) {
      console.error('Error fetching tenants from DB:', dbErr);
      tenantsList = [];
    }

    // Populate real usage_stats and doctor objects for each tenant
    const resolvedTenants = [];
    for (const t of tenantsList) {
      const usage = await computeTenantUsageStats(t.id).catch(() => ({
        total_patients: 0, total_appointments: 0, doctor_count: 0, whatsapp_connection: 'disconnected'
      }));

      resolvedTenants.push({
        ...t,
        usage_stats: usage,
        doctor: {
          name: t.owner_name,
          email: t.owner_email,
          phone: t.owner_phone
        }
      });
    }

    // Calculate Platform Statistics (KPIs)
    const totalClinics = tenantsList.length;
    const activeClinics = tenantsList.filter(t => t.status === 'active').length;
    const suspendedClinics = tenantsList.filter(t => t.status === 'suspended').length;
    
    // Pending Expiry within next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const pendingExpiry = tenantsList.filter(t => {
      const expiry = new Date(t.expires_at);
      return t.status === 'active' && expiry > now && expiry <= thirtyDaysFromNow;
    }).length;

    // Calculate Estimated MRR and plans breakdown from real plan prices
    const planPriceRows = await db.all('SELECT id, price_usd FROM plans').catch(() => []);
    const planPriceMap = {};
    (planPriceRows || []).forEach(p => { planPriceMap[p.id.toLowerCase()] = p.price_usd; });
    const fallbackPrice = { basic: 50, pro: 100, enterprise: 250 };

    let estimatedMRR = 0;
    let basicCount = 0;
    let proCount = 0;
    let enterpriseCount = 0;

    tenantsList.forEach(t => {
      if (t.status === 'active') {
        const plan = t.subscription_plan.toLowerCase();
        if (plan === 'basic') basicCount++;
        else if (plan === 'pro') proCount++;
        else if (plan === 'enterprise') enterpriseCount++;

        const price = planPriceMap[plan] != null ? planPriceMap[plan] : (fallbackPrice[plan] || 0);
        estimatedMRR += price;
      }
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

  } catch (error) {
    console.error('Error fetching admin tenants:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب البيانات" }
    });
  }
});

/**
 * POST /admin/v1/tenants
 * Onboard new tenant (Clinic) and owner user
 */
router.post('/admin/v1/tenants', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const {
    name,
    slug, 
    specialty, 
    email, 
    phone, 
    subscription_plan, 
    subscription_start_date, 
    subscription_expires_at 
  } = req.body;

  if (!name || !slug || !specialty || !email || !subscription_plan) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "جميع الحقول الأساسية مطلوبة لإنشاء العيادة" }
    });
  }

  try {
    const tenantId = `tenant-${Math.random().toString(36).substring(7)}`;
    const userId = `user-owner-${Math.random().toString(36).substring(7)}`;
    const docId = `doc-${Math.random().toString(36).substring(7)}`;
    
    const startDate = subscription_start_date ? new Date(subscription_start_date).toISOString() : new Date().toISOString();
    const expiresAt = subscription_expires_at ? new Date(subscription_expires_at).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Generate Secure Random Temporary Password
    const randomPassword = 'Cl-' + Math.random().toString(36).substring(2, 6) + '#' + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = bcrypt.hashSync(randomPassword, 10);

    const features = await getPlanFeatureFlags(subscription_plan);

    // 2. Check for duplicate slug in SQLite / DB
    const existingTenant = await db.get(`SELECT id FROM tenants WHERE LOWER(slug) = ?`, [slug.toLowerCase()]);
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        error: { code: "DUPLICATE_SLUG", message: "اسم رابط العيادة (Slug) مستخدم بالفعل" }
      });
    }

    // 3. Insert Tenant into Real Database
    await db.run(`
      INSERT INTO tenants (id, name, slug, status, subscription_plan, specialty, allow_multi_doctor, allow_insurance, allow_refunds, expires_at, created_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      name,
      slug.toLowerCase(),
      subscription_plan,
      specialty || 'dental',
      features.allow_multi_doctor ? 1 : 0,
      features.allow_insurance ? 1 : 0,
      features.allow_refunds ? 1 : 0,
      expiresAt,
      startDate
    ]);

    // 4. Insert Owner User into Real Database
    const ownerName = `د. مالك عيادة ${name}`;
    await db.run(`
      INSERT INTO users (id, tenant_id, full_name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active')
    `, [userId, tenantId, ownerName, email.toLowerCase(), phone || '+201012345678', passwordHash]);

    // 5. Insert Doctor Record
    await db.run(`
      INSERT INTO doctors (id, tenant_id, full_name, specialty)
      VALUES (?, ?, ?, ?)
    `, [docId, tenantId, ownerName, specialty || 'عام']);

    // 6. Seed Default Specialty Services for the new Clinic
    const starterServices = {
      dental: [
        { name: 'كشف عام', name_en: 'General Exam', price: 500, duration: 20, cat: 'exam' },
        { name: 'متابعة واستشارة', name_en: 'Follow-up', price: 0, duration: 15, cat: 'followup' },
        { name: 'تنظيف وتلميع أسنان', name_en: 'Teeth Cleaning', price: 800, duration: 30, cat: 'procedure' },
        { name: 'حشو عصب', name_en: 'Root Canal', price: 2500, duration: 60, cat: 'procedure' }
      ],
      orthopedic: [
        { name: 'كشف عظام ومفاصل', name_en: 'Orthopedic Exam', price: 600, duration: 30, cat: 'exam' },
        { name: 'متابعة', name_en: 'Follow-up', price: 300, duration: 15, cat: 'followup' },
        { name: 'أشعة سينية', name_en: 'X-Ray', price: 400, duration: 20, cat: 'diagnostic' },
        { name: 'علاج طبيعي', name_en: 'Physiotherapy', price: 800, duration: 45, cat: 'procedure' }
      ],
      dermatology: [
        { name: 'كشف جلدية وتجميل', name_en: 'Dermatology Exam', price: 600, duration: 25, cat: 'exam' },
        { name: 'جلسة ليزر', name_en: 'Laser Session', price: 1200, duration: 30, cat: 'procedure' },
        { name: 'تنظيف بشرة علاجي', name_en: 'HydraFacial', price: 1500, duration: 45, cat: 'procedure' }
      ],
      general: [
        { name: 'كشف طبي شامل', name_en: 'General Checkup', price: 400, duration: 20, cat: 'exam' },
        { name: 'استشارة ومتابعة', name_en: 'Follow-up', price: 200, duration: 15, cat: 'followup' }
      ]
    };

    const sList = starterServices[specialty] || starterServices.general;
    for (const svc of sList) {
      const sId = `svc-${Math.random().toString(36).substring(7)}`;
      await db.run(`
        INSERT INTO services (id, tenant_id, name, name_en, price, duration_minutes, category, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [sId, tenantId, svc.name, svc.name_en, svc.price, svc.duration, svc.cat]).catch(() => {});
    }

    const newTenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [tenantId]) || {
      id: tenantId,
      name,
      slug: slug.toLowerCase(),
      status: 'active',
      subscription_plan,
      specialty,
      expires_at: expiresAt
    };

    // Write audit log
    await logAdminAction(
      req.user.id,
      'tenant.create',
      'tenant',
      tenantId,
      { name, slug, specialty, subscription_plan, email },
      req
    );

    const activationLink = `http://localhost:3001`;

    // Send Welcome Email to Clinic Doctor with the generated random temporary password & Alert to Ops
    emailService.notifyNewClinicWelcome({
      tenant: newTenant,
      owner: { full_name: ownerName, email },
      temporaryPassword: randomPassword,
      activationLink
    }).catch(e => console.error('Welcome email error:', e));

    emailService.notifyOpsNewClinicOnboarded({
      tenant: newTenant,
      owner: { full_name: ownerName, email }
    }).catch(e => console.error('Ops onboard email error:', e));

    return res.status(201).json({
      success: true,
      data: {
        tenant: newTenant,
        temporary_password: randomPassword,
        activation_link: activationLink
      }
    });

  } catch (error) {
    console.error('Error onboarding clinic:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ داخلي أثناء إنشاء العيادة" }
    });
  }
});

/**
 * PUT /admin/v1/tenants/:id/subscription
 * Modify subscription plan or extend expiry date
 */
router.put('/admin/v1/tenants/:id/subscription', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { subscription_plan, months_to_extend } = req.body;

  if (!subscription_plan && !months_to_extend) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "الخطة أو عدد شهور التمديد مطلوبة" }
    });
  }

  try {
    let tenant = null;
    let oldPlan = null;
    let oldExpiresAt = null;
    let updatedExpiresAt = null;
    let newPlan = null;

    if (db.isMock) {
      tenant = db.memoryDB.tenants.find(t => t.id === id);
      if (tenant) {
        oldPlan = tenant.subscription_plan;
        oldExpiresAt = tenant.expires_at;

        if (subscription_plan) {
          tenant.subscription_plan = subscription_plan;
          const features = await getPlanFeatureFlags(subscription_plan);
          tenant.allow_multi_doctor = features.allow_multi_doctor;
          tenant.allow_insurance = features.allow_insurance;
          tenant.allow_refunds = features.allow_refunds;
        }
        if (months_to_extend) {
          const currentExpiry = new Date(tenant.expires_at);
          currentExpiry.setMonth(currentExpiry.getMonth() + parseInt(months_to_extend));
          tenant.expires_at = currentExpiry.toISOString();
        }
        updatedExpiresAt = tenant.expires_at;
        newPlan = tenant.subscription_plan;
      }
    } else {
      // Database Mode
      const selectRes = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
      if (selectRes.rows.length > 0) {
        tenant = selectRes.rows[0];
        oldPlan = tenant.subscription_plan;
        oldExpiresAt = tenant.expires_at;

        newPlan = subscription_plan || tenant.subscription_plan;
        let newExpiry = new Date(tenant.expires_at);
        if (months_to_extend) {
          newExpiry.setMonth(newExpiry.getMonth() + parseInt(months_to_extend));
        }

        const features = await getPlanFeatureFlags(newPlan);
        const updateRes = await db.query(
          `UPDATE tenants
           SET subscription_plan = $1, expires_at = $2, allow_multi_doctor = $3, allow_insurance = $4, allow_refunds = $5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 RETURNING *`,
          [newPlan, newExpiry.toISOString(), features.allow_multi_doctor, features.allow_insurance, features.allow_refunds, id]
        );
        tenant = updateRes.rows[0];
        updatedExpiresAt = tenant.expires_at;
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة المطلوبة غير موجودة" }
      });
    }

    // Write subscription history entry
    const historyEntry = {
      id: `sub-hist-${Math.random().toString(36).substring(7)}`,
      tenant_id: id,
      action: months_to_extend && subscription_plan ? 'renewed' : (months_to_extend ? 'extended' : 'upgraded'),
      old_plan: oldPlan,
      new_plan: newPlan,
      old_expires_at: oldExpiresAt,
      new_expires_at: updatedExpiresAt,
      reason: req.body.reason || 'Manual subscription modification',
      changed_by_admin_id: req.user.id,
      created_at: new Date().toISOString()
    };
    if (db.isMock) {
      if (!db.memoryDB.subscription_history) {
        db.memoryDB.subscription_history = [];
      }
      db.memoryDB.subscription_history.push(historyEntry);
    } else {
      try {
        await db.query(
          `INSERT INTO subscription_history (tenant_id, action, old_plan, new_plan, old_expires_at, new_expires_at, reason, changed_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [historyEntry.tenant_id, historyEntry.action, historyEntry.old_plan, historyEntry.new_plan, historyEntry.old_expires_at, historyEntry.new_expires_at, historyEntry.reason, historyEntry.changed_by_admin_id]
        );
      } catch (historyErr) {
        console.error('Failed to log subscription history to DB:', historyErr);
      }
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'subscription.change',
      'tenant',
      id,
      { oldPlan, newPlan, oldExpiresAt, newExpiresAt: updatedExpiresAt, months_to_extend },
      req
    );

    // Find owner email for notification
    let ownerEmail = null;
    if (db.isMock) {
      const ownerUser = db.memoryDB.users.find(u => u.tenant_id === id);
      ownerEmail = ownerUser ? ownerUser.email : null;
    } else {
      try {
        const oRes = await db.query(`SELECT email FROM users WHERE tenant_id = $1 LIMIT 1`, [id]);
        if (oRes.rows.length > 0) ownerEmail = oRes.rows[0].email;
      } catch (e) {}
    }

    // Trigger Email Notification for Subscription update
    emailService.notifyClinicSubscriptionUpdated({
      tenant,
      ownerEmail,
      oldPlan,
      newPlan,
      newExpiresAt: updatedExpiresAt,
      reason: req.body.reason || 'تعديل وتحديث باقة الاشتراك'
    }).catch(e => console.error('Sub email error:', e));

    return res.status(200).json({
      success: true,
      data: tenant
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تعديل الاشتراك" }
    });
  }
});

/**
 * PUT /admin/v1/tenants/:id/status
 * Suspend or reactivate clinic access
 */
router.put('/admin/v1/tenants/:id/status', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "حالة العيادة غير صالحة" }
    });
  }

  try {
    let tenant = null;

    if (db.isMock) {
      tenant = db.memoryDB.tenants.find(t => t.id === id);
      if (tenant) {
        tenant.status = status;
      }
    } else {
      const result = await db.query(
        'UPDATE tenants SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );
      if (result.rows.length > 0) {
        tenant = result.rows[0];
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة غير موجودة" }
      });
    }

    // Write audit log
    await logAdminAction(
      req.user.id,
      status === 'suspended' ? 'tenant.deactivate' : 'tenant.activate',
      'tenant',
      id,
      { status },
      req
    );

    // Find owner email for notification
    let ownerEmail = null;
    if (db.isMock) {
      const ownerUser = db.memoryDB.users.find(u => u.tenant_id === id);
      ownerEmail = ownerUser ? ownerUser.email : null;
    } else {
      try {
        const oRes = await db.query(`SELECT email FROM users WHERE tenant_id = $1 LIMIT 1`, [id]);
        if (oRes.rows.length > 0) ownerEmail = oRes.rows[0].email;
      } catch (e) {}
    }

    // Trigger Email Alert for Clinic Suspension/Activation
    emailService.notifyClinicStatusChanged({
      tenant,
      ownerEmail,
      status
    }).catch(e => console.error('Status email error:', e));

    return res.status(200).json({
      success: true,
      data: tenant
    });

  } catch (error) {
    console.error('Error updating clinic status:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تغيير حالة العيادة" }
    });
  }
});

/**
 * GET /admin/v1/tenants/:id
 * Get full tenant details, including owner details
 */
router.get('/admin/v1/tenants/:id', async (req, res) => {
  const { id } = req.params;

  try {
    let tenant = null;
    let owner = null;

    tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (tenant) {
      owner = await db.get('SELECT * FROM users WHERE tenant_id = ? AND role = "owner" ORDER BY id ASC LIMIT 1', [id]);
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة المطلوبة غير موجودة" }
      });
    }

    const usage_stats = await computeTenantUsageStats(id).catch(() => ({
      total_patients: 0, total_appointments: 0, doctor_count: 0, whatsapp_connection: 'disconnected'
    }));

    return res.status(200).json({
      success: true,
      data: {
        tenant: { ...tenant, usage_stats },
        owner: owner ? {
          email: owner.email,
          phone: owner.phone,
          full_name: owner.full_name
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching tenant details:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب تفاصيل العيادة" }
    });
  }
});

/**
 * PUT /admin/v1/tenants/:id
 * Update tenant details (Name, Specialty, Plan, Owner Phone/Email)
 */
router.put('/admin/v1/tenants/:id', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, specialty, subscription_plan, email, phone } = req.body;

  try {
    let tenant = null;
    let owner = null;

    if (db.isMock) {
      tenant = db.memoryDB.tenants.find(t => t.id === id);
      if (tenant) {
        if (name) tenant.name = name;
        if (specialty) tenant.specialty = specialty;
        if (subscription_plan) tenant.subscription_plan = subscription_plan;
        
        owner = db.memoryDB.users.find(u => u.tenant_id === id);
        if (owner) {
          if (email) owner.email = email.toLowerCase();
          if (phone) owner.phone = phone;
        }
      }
    } else {
      // Postgres Mode
      const selectRes = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
      if (selectRes.rows.length > 0) {
        tenant = selectRes.rows[0];
        
        let newName = name || tenant.name;
        let newSpecialty = specialty || tenant.specialty;
        let newPlan = subscription_plan || tenant.subscription_plan;
        
        await db.query('BEGIN');
        try {
          const tenantRes = await db.query(
            `UPDATE tenants SET name = $1, specialty = $2, subscription_plan = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 RETURNING *`,
            [newName, newSpecialty, newPlan, id]
          );
          tenant = tenantRes.rows[0];
          
          if (email || phone) {
            // `users` has a flat `role` text column — no `roles`/`role_id` table exists.
            const ownerRes = await db.query(
              `SELECT * FROM users WHERE tenant_id = $1 AND role = 'owner' LIMIT 1`,
              [id]
            );
            if (ownerRes.rows.length > 0) {
              const dbOwner = ownerRes.rows[0];
              let newEmail = email ? email.toLowerCase() : dbOwner.email;
              let newPhone = phone || dbOwner.phone;

              const userRes = await db.query(
                `UPDATE users SET email = $1, phone = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 RETURNING *`,
                [newEmail, newPhone, dbOwner.id]
              );
              owner = userRes.rows[0];
            }
          }
          await db.query('COMMIT');
        } catch (dbErr) {
          await db.query('ROLLBACK');
          throw dbErr;
        }
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة غير موجودة" }
      });
    }

    // Write audit log
    await logAdminAction(
      req.user.id,
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
        owner: owner ? { email: owner.email, phone: owner.phone } : null
      }
    });

  } catch (error) {
    console.error('Error updating tenant details:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تعديل بيانات العيادة" }
    });
  }
});

/**
 * DELETE /admin/v1/tenants/:id
 * Delete tenant and associated users/roles (only if suspended/inactive)
 */
router.delete('/admin/v1/tenants/:id', requireAdminRole('super_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    let tenant = null;

    if (db.isMock) {
      const tenantIndex = db.memoryDB.tenants.findIndex(t => t.id === id);
      if (tenantIndex !== -1) {
        tenant = db.memoryDB.tenants[tenantIndex];
        
        // Check if subscription is active
        const now = new Date();
        const expiry = new Date(tenant.expires_at);
        if (tenant.status === 'active' && expiry > now) {
          return res.status(400).json({
            success: false,
            error: { code: "ACTIVE_SUBSCRIPTION", message: "لا يمكن حذف عيادة باشتراك نشط. يرجى تعليق الاشتراك أولاً." }
          });
        }
        
        // Delete tenant, associated roles, and users from mock database
        db.memoryDB.tenants.splice(tenantIndex, 1);
        db.memoryDB.users = db.memoryDB.users.filter(u => u.tenant_id !== id);
        db.memoryDB.roles = db.memoryDB.roles.filter(r => r.tenant_id !== id);
      }
    } else {
      // Database Mode
      const selectRes = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
      if (selectRes.rows.length > 0) {
        tenant = selectRes.rows[0];
        
        const now = new Date();
        const expiry = new Date(tenant.expires_at);
        if (tenant.status === 'active' && expiry > now) {
          return res.status(400).json({
            success: false,
            error: { code: "ACTIVE_SUBSCRIPTION", message: "لا يمكن حذف عيادة باشتراك نشط. يرجى تعليق الاشتراك أولاً." }
          });
        }

        await db.query('BEGIN');
        try {
          await db.query('DELETE FROM users WHERE tenant_id = $1', [id]);
          await db.query('DELETE FROM roles WHERE tenant_id = $1', [id]);
          await db.query('DELETE FROM tenants WHERE id = $1', [id]);
          await db.query('COMMIT');
        } catch (dbErr) {
          await db.query('ROLLBACK');
          throw dbErr;
        }
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة غير موجودة" }
      });
    }

    // Write audit log
    await logAdminAction(
      req.user.id,
      'tenant.delete',
      'tenant',
      id,
      { name: tenant.name },
      req
    );

    return res.status(200).json({
      success: true,
      message: "تم حذف العيادة وجميع بياناتها المرتبطة بنجاح"
    });

  } catch (error) {
    console.error('Error deleting tenant:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء محاولة حذف العيادة" }
    });
  }
});

/**
 * POST /admin/v1/tenants/:id/reset-password
 * Reset doctor password and email the newly generated password to the doctor
 */
router.post('/admin/v1/tenants/:id/reset-password', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة غير موجودة" }
      });
    }

    const owner = await db.get('SELECT * FROM users WHERE tenant_id = ? AND role = "owner" ORDER BY id ASC LIMIT 1', [id]);
    if (!owner) {
      return res.status(404).json({
        success: false,
        error: { code: "OWNER_NOT_FOUND", message: "لم يتم العثور على حساب الطبيب المالك" }
      });
    }

    // Generate new random temporary password
    const newPassword = 'Cl-' + Math.random().toString(36).substring(2, 6) + '#' + Math.floor(1000 + Math.random() * 9000);
    const passwordHash = bcrypt.hashSync(newPassword, 10);

    // Update in SQLite / Database
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, owner.id]);

    // Send email to the doctor with the new password
    emailService.notifyDoctorPasswordReset({
      owner,
      tenant,
      resetLink: 'http://localhost:3001',
      temporaryPassword: newPassword
    }).catch(e => console.error('Reset email error:', e));

    // Write audit log
    await logAdminAction(
      req.user.id,
      'doctor.reset_password',
      'tenant',
      id,
      { doctorEmail: owner.email },
      req
    );

    return res.status(200).json({
      success: true,
      message: `تمت إعادة تعيين كلمة المرور بنجاح وإرسالها إلى البريد الإلكتروني ${owner.email}`,
      data: {
        email: owner.email,
        temporary_password: newPassword,
        login_url: 'http://localhost:3001',
        reset_link: 'http://localhost:3001'
      }
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء إعادة تعيين كلمة المرور" }
    });
  }
});

/**
 * PUT /admin/v1/tenants/:id/features
 * Override Feature Flags manually
 */
router.put('/admin/v1/tenants/:id/features', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { 
    allow_multi_doctor, 
    allow_insurance, 
    allow_refunds,
    allow_whatsapp,
    allow_analytics,
    allow_voice_bot
  } = req.body;

  try {
    let tenant = null;

    if (db.isMock) {
      tenant = db.memoryDB.tenants.find(t => t.id === id);
      if (tenant) {
        if (allow_multi_doctor !== undefined) tenant.allow_multi_doctor = allow_multi_doctor;
        if (allow_insurance !== undefined) tenant.allow_insurance = allow_insurance;
        if (allow_refunds !== undefined) tenant.allow_refunds = allow_refunds;
        if (allow_whatsapp !== undefined) tenant.allow_whatsapp = allow_whatsapp;
        if (allow_analytics !== undefined) tenant.allow_analytics = allow_analytics;
        if (allow_voice_bot !== undefined) tenant.allow_voice_bot = allow_voice_bot;
      }
    } else {
      // Fetch current tenant
      const checkRes = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
      if (checkRes.rows.length > 0) {
        const t = checkRes.rows[0];
        const newMulti = allow_multi_doctor !== undefined ? allow_multi_doctor : t.allow_multi_doctor;
        const newInsurance = allow_insurance !== undefined ? allow_insurance : t.allow_insurance;
        const newRefunds = allow_refunds !== undefined ? allow_refunds : t.allow_refunds;
        
        // Dynamic columns in postgres if exist
        let updateRes;
        try {
          updateRes = await db.query(
            `UPDATE tenants 
             SET allow_multi_doctor = $1, allow_insurance = $2, allow_refunds = $3, 
                 allow_whatsapp = COALESCE($4, allow_whatsapp), 
                 allow_analytics = COALESCE($5, allow_analytics), 
                 allow_voice_bot = COALESCE($6, allow_voice_bot), 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $7 RETURNING *`,
            [
              newMulti, 
              newInsurance, 
              newRefunds, 
              allow_whatsapp !== undefined ? allow_whatsapp : null, 
              allow_analytics !== undefined ? allow_analytics : null, 
              allow_voice_bot !== undefined ? allow_voice_bot : null, 
              id
            ]
          );
        } catch (dbErr) {
          // Fallback if custom columns are not yet in postgres
          updateRes = await db.query(
            `UPDATE tenants 
             SET allow_multi_doctor = $1, allow_insurance = $2, allow_refunds = $3, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4 RETURNING *`,
            [newMulti, newInsurance, newRefunds, id]
          );
        }
        tenant = updateRes.rows[0];
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة غير موجودة" }
      });
    }

    // Write audit log
    await logAdminAction(
      req.user.id,
      'tenant.update_features',
      'tenant',
      id,
      { allow_multi_doctor, allow_insurance, allow_refunds, allow_whatsapp, allow_analytics, allow_voice_bot },
      req
    );

    return res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (err) {
    console.error('Error updating tenant features:', err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تعديل ميزات العيادة" }
    });
  }
});

/**
 * GET /admin/v1/audit-logs
 * Fetch recent operator audit logs
 */
router.get('/admin/v1/audit-logs', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 5000);
    let logs = [];
    if (db.isMock) {
      logs = db.memoryDB.admin_audit_logs || [];
    } else {
      const result = await db.query(
        `SELECT l.*, a.full_name as operator_name
         FROM admin_audit_logs l
         LEFT JOIN admin_users a ON a.id = l.admin_id
         ORDER BY l.created_at DESC LIMIT $1`,
        [limit]
      );
      logs = result.rows;
    }

    // Map operator name for mock mode too
    const resolvedLogs = logs.map(l => {
      let operatorName = "مشغل النظام";
      if (db.isMock) {
        const op = db.memoryDB.admin_users.find(u => u.id === l.admin_id);
        if (op) operatorName = op.full_name;
      } else {
        operatorName = l.operator_name || "مشغل النظام";
      }
      return {
        ...l,
        operator_name: operatorName
      };
    });

    return res.status(200).json({
      success: true,
      data: resolvedLogs
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب سجل العمليات" }
    });
  }
});

/**
 * GET /admin/v1/tickets
 * List all clinic-submitted support/upgrade/renewal tickets
 */
router.get('/admin/v1/tickets', async (req, res) => {
  try {
    let tickets = [];
    if (db.isMock) {
      tickets = [...db.memoryDB.tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      const result = await db.query(
        `SELECT t.*, a.full_name as assignee_name
         FROM tickets t
         LEFT JOIN admin_users a ON a.id = t.assigned_to
         ORDER BY t.created_at DESC`
      );
      tickets = result.rows;
    }
    return res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب طلبات الدعم الفني" }
    });
  }
});

/**
 * PUT /admin/v1/tickets/:id
 * Update a ticket's status and add an operator response
 */
const TICKET_SLA_HOURS = { urgent: 4, high: 24, normal: 72, low: 168 };

router.put('/admin/v1/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const { status, response_notes, priority, assigned_to } = req.body;
  const validStatuses = ['pending', 'processing', 'resolved', 'rejected'];
  const validPriorities = ['low', 'normal', 'high', 'urgent'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "حالة الطلب غير صالحة" }
    });
  }
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "أولوية الطلب غير صالحة" }
    });
  }

  try {
    if (assigned_to) {
      const assignee = await db.get('SELECT id FROM admin_users WHERE id = ?', [assigned_to]);
      if (!assignee) {
        return res.status(400).json({ success: false, error: { code: "INVALID_ASSIGNEE", message: "المشغل المحدد غير موجود" } });
      }
    }

    const dueAt = priority ? new Date(Date.now() + (TICKET_SLA_HOURS[priority] || TICKET_SLA_HOURS.normal) * 3600 * 1000).toISOString() : null;

    let updated = null;
    if (db.isMock) {
      const ticket = db.memoryDB.tickets.find(t => t.id === id);
      if (!ticket) {
        return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "الطلب غير موجود" } });
      }
      if (status) ticket.status = status;
      if (response_notes !== undefined) ticket.response_notes = response_notes;
      if (priority) { ticket.priority = priority; ticket.due_at = dueAt; }
      if (assigned_to) ticket.assigned_to = assigned_to;
      updated = ticket;
    } else {
      await db.query(
        `UPDATE tickets SET status = COALESCE($1, status), response_notes = COALESCE($2, response_notes),
         priority = COALESCE($3, priority), assigned_to = COALESCE($4, assigned_to), due_at = COALESCE($5, due_at)
         WHERE id = $6`,
        [status || null, response_notes !== undefined ? response_notes : null, priority || null, assigned_to || null, dueAt, id]
      );
      const result = await db.query(
        `SELECT t.*, a.full_name as assignee_name FROM tickets t LEFT JOIN admin_users a ON a.id = t.assigned_to WHERE t.id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "الطلب غير موجود" } });
      }
      updated = result.rows[0];
    }

    await logAdminAction(req.user.id, 'ticket.update', 'ticket', id, { status, response_notes, priority, assigned_to }, req);

    // Send Email to Clinic with Operator's response
    let clinicEmail = null;
    if (updated.tenant_id) {
      if (db.isMock) {
        const ownerUser = db.memoryDB.users.find(u => u.tenant_id === updated.tenant_id);
        clinicEmail = ownerUser ? ownerUser.email : null;
      } else {
        try {
          const uRes = await db.query(`SELECT email FROM users WHERE tenant_id = $1 LIMIT 1`, [updated.tenant_id]);
          if (uRes.rows.length > 0) clinicEmail = uRes.rows[0].email;
        } catch(e) {}
      }
    }

    emailService.notifyClinicTicketReplied({
      ticket: updated,
      clinicEmail,
      responseNotes: response_notes || updated.response_notes,
      status: status || updated.status
    }).catch(e => console.error('Ticket reply email error:', e));

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تحديث الطلب" }
    });
  }
});

/**
 * GET /admin/v1/tenants/:id/subscription-history
 * Fetch subscription history for a specific clinic
 */
router.get('/admin/v1/tenants/:id/subscription-history', async (req, res) => {
  const { id } = req.params;

  try {
    let history = [];
    if (db.isMock) {
      const allHist = db.memoryDB.subscription_history || [];
      history = allHist.filter(h => h.tenant_id === id);
    } else {
      const result = await db.query(
        `SELECT h.*, a.full_name as operator_name
         FROM subscription_history h
         LEFT JOIN admin_users a ON a.id = h.changed_by_admin_id
         WHERE h.tenant_id = $1
         ORDER BY h.created_at DESC`,
        [id]
      );
      history = result.rows;
    }

    // Resolve operator name for history items
    const resolvedHistory = history.map(h => {
      let operatorName = "مشغل النظام";
      if (db.isMock) {
        const op = db.memoryDB.admin_users.find(u => u.id === h.changed_by_admin_id);
        if (op) operatorName = op.full_name;
      } else {
        operatorName = h.operator_name || "مشغل النظام";
      }
      return {
        ...h,
        operator_name: operatorName
      };
    });

    return res.status(200).json({
      success: true,
      data: resolvedHistory
    });
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب تاريخ الاشتراكات" }
    });
  }
});

/**
 * GET /admin/v1/tenants/:id/doctors
 * Fetch list of doctors for a specific clinic
 */
router.get('/admin/v1/tenants/:id/doctors', async (req, res) => {
  const { id } = req.params;
  try {
    let docs = [];
    if (db.isMock) {
      docs = db.memoryDB.doctors.filter(d => d.tenant_id === id);
    } else {
      // `users` has a flat `role` text column — no `roles`/`role_id` table exists.
      const result = await db.query(
        `SELECT id, full_name, phone, email, role
         FROM users
         WHERE tenant_id = $1 AND (role = 'doctor' OR role = 'owner')`,
        [id]
      );
      docs = result.rows.map(row => ({
        id: row.id,
        tenant_id: id,
        full_name: row.full_name,
        specialty: row.role === 'owner' ? 'طبيب مالك' : 'طبيب فرعي'
      }));
    }

    return res.status(200).json({
      success: true,
      data: docs
    });
  } catch (error) {
    console.error('Error fetching clinic doctors:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب قائمة الأطباء" }
    });
  }
});

/**
 * POST /admin/v1/tenants/:id/doctors
 * Add a new doctor to a clinic (checks allow_multi_doctor flag)
 */
router.post('/admin/v1/tenants/:id/doctors', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const { full_name, specialty } = req.body;

  if (!full_name) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "اسم الطبيب مطلوب" }
    });
  }

  try {
    let tenant;
    if (db.isMock) {
      tenant = db.memoryDB.tenants.find(t => t.id === id);
    } else {
      const tenantRes = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
      if (tenantRes.rows.length > 0) tenant = tenantRes.rows[0];
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "العيادة غير موجودة" }
      });
    }

    // Check Multi-Doctor permission
    if (!tenant.allow_multi_doctor) {
      let doctorCount = 0;
      if (db.isMock) {
        doctorCount = db.memoryDB.doctors.filter(d => d.tenant_id === id).length;
      } else {
        const docCountRes = await db.query(
          `SELECT COUNT(*) as count FROM users
           WHERE tenant_id = $1 AND (role = 'doctor' OR role = 'owner')`,
          [id]
        );
        doctorCount = parseInt(docCountRes.rows[0].count) || 0;
      }

      if (doctorCount >= 1) {
        return res.status(403).json({
          success: false,
          error: {
            code: "MULTI_DOCTOR_DISABLED",
            message: "الخطة الحالية للعيادة لا تدعم إضافة أكثر من طبيب واحد. يرجى ترقية باقة الاشتراك لـ Pro أو Enterprise أولاً لتفعيل ميزة الأطباء المتعددين."
          }
        });
      }
    }

    // Add Doctor
    const docId = `doc-${Math.random().toString(36).substring(7)}`;
    if (db.isMock) {
      db.memoryDB.doctors.push({
        id: docId,
        tenant_id: id,
        full_name,
        specialty: specialty || 'عمومي'
      });
    } else {
      // `users` has a flat `role` text column — no `roles`/`role_id` table exists.
      const email = `${docId}@clinic.com`;
      const passHash = '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6'; // SecurePassword123!

      await db.query(
        `INSERT INTO users (id, tenant_id, full_name, email, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, 'doctor', 'active')`,
        [docId, id, full_name, email, passHash]
      );
    }

    // Log admin action
    await logAdminAction(
      req.user.id,
      'tenant.add_doctor',
      'tenant',
      id,
      { doctorName: full_name, specialty },
      req
    );

    return res.status(201).json({
      success: true,
      message: "تم إضافة الطبيب بنجاح للعيادة",
      data: {
        id: docId,
        full_name,
        specialty: specialty || 'عمومي'
      }
    });

  } catch (error) {
    console.error('Error adding doctor to clinic:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء محاولة إضافة الطبيب" }
    });
  }
});

/**
 * GET /admin/v1/plans
 * Fetch all dynamic subscription plans
 */
router.get('/admin/v1/plans', async (req, res) => {
  try {
    if (db.isMock) {
      return res.status(200).json({
        success: true,
        data: db.memoryDB.plans
      });
    } else {
      try {
        const result = await db.query('SELECT * FROM plans ORDER BY id ASC');
        return res.status(200).json({
          success: true,
          data: result.rows
        });
      } catch (err) {
        return res.status(200).json({
          success: true,
          data: db.memoryDB.plans
        });
      }
    }
  } catch (error) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب خطط الباقات" }
    });
  }
});

/**
 * PUT /admin/v1/plans/:id
 * Configure/update plan prices and default feature flags
 */
router.put('/admin/v1/plans/:id', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;
  const {
    name,
    price_egp,
    price_usd,
    allow_multi_doctor,
    allow_insurance,
    allow_refunds,
    allow_whatsapp,
    allow_telegram,
    allow_analytics,
    allow_voice_bot,
    allow_custom_branding
  } = req.body;

  for (const [field, value] of [['price_egp', price_egp], ['price_usd', price_usd]]) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      return res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: `قيمة ${field} يجب أن تكون رقماً صحيحاً غير سالب` }
      });
    }
  }

  try {
    const existing = await db.get('SELECT * FROM plans WHERE id = ?', [id]);
    const finalName = name || (existing && existing.name);
    if (!finalName) {
      return res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "اسم الباقة مطلوب" }
      });
    }

    await db.run(
      `INSERT INTO plans (id, name, price_egp, price_usd, allow_multi_doctor, allow_insurance, allow_refunds, allow_whatsapp, allow_telegram, allow_analytics, allow_voice_bot, allow_custom_branding, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, price_egp=excluded.price_egp, price_usd=excluded.price_usd,
         allow_multi_doctor=excluded.allow_multi_doctor, allow_insurance=excluded.allow_insurance, allow_refunds=excluded.allow_refunds,
         allow_whatsapp=excluded.allow_whatsapp, allow_telegram=excluded.allow_telegram, allow_analytics=excluded.allow_analytics,
         allow_voice_bot=excluded.allow_voice_bot, allow_custom_branding=excluded.allow_custom_branding, updated_at=CURRENT_TIMESTAMP`,
      [
        id, finalName,
        price_egp ?? (existing ? existing.price_egp : 0),
        price_usd ?? (existing ? existing.price_usd : 0),
        allow_multi_doctor !== undefined ? (allow_multi_doctor ? 1 : 0) : (existing ? existing.allow_multi_doctor : 0),
        allow_insurance !== undefined ? (allow_insurance ? 1 : 0) : (existing ? existing.allow_insurance : 0),
        allow_refunds !== undefined ? (allow_refunds ? 1 : 0) : (existing ? existing.allow_refunds : 0),
        allow_whatsapp !== undefined ? (allow_whatsapp ? 1 : 0) : (existing ? existing.allow_whatsapp : 0),
        allow_telegram !== undefined ? (allow_telegram ? 1 : 0) : (existing ? existing.allow_telegram : 0),
        allow_analytics !== undefined ? (allow_analytics ? 1 : 0) : (existing ? existing.allow_analytics : 0),
        allow_voice_bot !== undefined ? (allow_voice_bot ? 1 : 0) : (existing ? existing.allow_voice_bot : 0),
        allow_custom_branding !== undefined ? (allow_custom_branding ? 1 : 0) : (existing ? existing.allow_custom_branding : 0)
      ]
    );

    const plan = await db.get('SELECT * FROM plans WHERE id = ?', [id]);

    // Write audit log
    await logAdminAction(
      req.user.id,
      existing ? 'plan.update_config' : 'plan.create',
      'plan',
      id,
      { price_egp, price_usd },
      req
    );

    return res.status(200).json({
      success: true,
      data: plan
    });

  } catch (error) {
    console.error('Error configuring plan:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تعديل خصائص الباقة" }
    });
  }
});

/**
 * DELETE /admin/v1/plans/:id
 * Delete a custom plan (system plans and plans with active tenants are protected)
 */
router.delete('/admin/v1/plans/:id', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { id } = req.params;

  if (['basic', 'pro', 'enterprise'].includes(id.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: { code: "SYSTEM_PLAN", message: "لا يمكن حذف باقات النظام الأساسية." }
    });
  }

  try {
    const plan = await db.get('SELECT * FROM plans WHERE id = ?', [id]);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "الباقة غير موجودة" }
      });
    }

    const inUse = await db.get(`SELECT COUNT(*) as count FROM tenants WHERE subscription_plan = ? AND status = 'active'`, [id]);
    if (inUse && inUse.count > 0) {
      return res.status(400).json({
        success: false,
        error: { code: "PLAN_IN_USE", message: `لا يمكن حذف الباقة لوجود ${inUse.count} عيادة نشطة مشتركة بها حالياً.` }
      });
    }

    await db.run('DELETE FROM plans WHERE id = ?', [id]);
    await logAdminAction(req.user.id, 'plan.delete', 'plan', id, { name: plan.name }, req);

    return res.status(200).json({ success: true, message: "تم حذف الباقة بنجاح" });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء حذف الباقة" }
    });
  }
});

/**
 * ==========================================
 * Ops team management (admin_users)
 * ==========================================
 */

/**
 * GET /admin/v1/admin-users
 * List all platform operators — super_admin only
 */
router.get('/admin/v1/admin-users', requireAdminRole('super_admin'), async (req, res) => {
  try {
    const rows = await db.all('SELECT id, email, full_name, role, status, created_at FROM admin_users ORDER BY created_at ASC');
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب فريق العمليات" }
    });
  }
});

/**
 * GET /admin/v1/admin-users/assignable
 * Lightweight active-operator list for ticket-assignee pickers — open to any operator
 */
router.get('/admin/v1/admin-users/assignable', async (req, res) => {
  try {
    const rows = await db.all(`SELECT id, full_name FROM admin_users WHERE status = 'active' ORDER BY full_name ASC`);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching assignable admin users:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب قائمة المشغلين" }
    });
  }
});

/**
 * POST /admin/v1/admin-users
 * Create a new platform operator — super_admin only
 */
router.post('/admin/v1/admin-users', requireAdminRole('super_admin'), async (req, res) => {
  const { email, password, full_name, role } = req.body;
  const validRoles = ['super_admin', 'admin', 'support'];

  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "كل الحقول مطلوبة" } });
  }
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "دور غير صالح" } });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, error: { code: "WEAK_PASSWORD", message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" } });
  }

  try {
    const existing = await db.get('SELECT id FROM admin_users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ success: false, error: { code: "DUPLICATE_EMAIL", message: "البريد الإلكتروني مستخدم بالفعل" } });
    }

    const id = `admin-${Math.random().toString(36).substring(2, 10)}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.run(
      `INSERT INTO admin_users (id, email, password_hash, full_name, role, status) VALUES (?,?,?,?,?, 'active')`,
      [id, email.toLowerCase(), passwordHash, full_name, role]
    );

    await logAdminAction(req.user.id, 'admin_user.create', 'admin_user', id, { email, full_name, role }, req);

    return res.status(201).json({
      success: true,
      data: { id, email: email.toLowerCase(), full_name, role, status: 'active' }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء إنشاء حساب المشغل" }
    });
  }
});

/**
 * PUT /admin/v1/admin-users/:id
 * Edit an operator's name/role/status — super_admin only, with a self-lockout guard
 */
router.put('/admin/v1/admin-users/:id', requireAdminRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { full_name, role, status } = req.body;

  if (role && !['super_admin', 'admin', 'support'].includes(role)) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "دور غير صالح" } });
  }
  if (status && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "حالة غير صالحة" } });
  }

  try {
    const target = await db.get('SELECT * FROM admin_users WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "المشغل غير موجود" } });
    }

    const leavingSuperAdmin = target.role === 'super_admin' && ((role && role !== 'super_admin') || (status && status !== 'active'));
    if (leavingSuperAdmin) {
      const remaining = await db.get(
        `SELECT COUNT(*) as count FROM admin_users WHERE role = 'super_admin' AND status = 'active' AND id != ?`,
        [id]
      );
      if (!remaining || remaining.count === 0) {
        return res.status(400).json({
          success: false,
          error: { code: "LAST_SUPER_ADMIN", message: "لا يمكن إزالة صلاحيات آخر مشغل بدرجة Super Admin نشط في المنصة." }
        });
      }
    }

    await db.run(
      `UPDATE admin_users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?`,
      [full_name || null, role || null, status || null, id]
    );
    const updated = await db.get('SELECT id, email, full_name, role, status, created_at FROM admin_users WHERE id = ?', [id]);

    await logAdminAction(req.user.id, 'admin_user.update', 'admin_user', id, { full_name, role, status }, req);

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating admin user:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء تعديل بيانات المشغل" }
    });
  }
});

/**
 * ==========================================
 * Revenue / churn reporting (proxy — no invoicing data exists)
 * ==========================================
 */

/**
 * GET /admin/v1/reports/revenue-churn
 * 12-month revenue-activity + churn proxy, derived from subscription_history
 * and admin_audit_logs (no invoices table exists — billing is out of scope).
 */
router.get('/admin/v1/reports/revenue-churn', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  try {
    const events = await db.all(
      `SELECT strftime('%Y-%m', created_at) as month, new_plan
       FROM subscription_history WHERE created_at >= date('now','-12 months')`
    );
    const planPriceRows = await db.all('SELECT id, price_usd FROM plans');
    const priceMap = {};
    planPriceRows.forEach(p => { priceMap[p.id.toLowerCase()] = p.price_usd; });

    const revenueByMonth = {};
    events.forEach(e => {
      const m = e.month;
      const plan = (e.new_plan || '').toLowerCase();
      if (!m) return;
      revenueByMonth[m] = revenueByMonth[m] || { basic: 0, pro: 0, enterprise: 0, proxy_value_usd: 0 };
      if (['basic', 'pro', 'enterprise'].includes(plan)) revenueByMonth[m][plan]++;
      revenueByMonth[m].proxy_value_usd += priceMap[plan] || 0;
    });
    const revenue_trend = Object.keys(revenueByMonth).sort().map(m => ({ month: m, ...revenueByMonth[m] }));

    const churnRows = await db.all(
      `SELECT strftime('%Y-%m', created_at) as month,
         SUM(CASE WHEN action = 'tenant.deactivate' THEN 1 ELSE 0 END) as suspensions,
         SUM(CASE WHEN action = 'tenant.activate' THEN 1 ELSE 0 END) as reactivations
       FROM admin_audit_logs
       WHERE target_type = 'tenant' AND created_at >= date('now','-12 months')
       GROUP BY month ORDER BY month ASC`
    );
    const totalTenantsRow = await db.get('SELECT COUNT(*) as count FROM tenants');
    const totalTenants = (totalTenantsRow && totalTenantsRow.count) || 1;
    const churn_trend = churnRows.filter(r => r.month).map(r => ({
      ...r,
      churn_rate_pct: +(((r.suspensions || 0) / totalTenants) * 100).toFixed(1)
    }));

    const activeClinicsRow = await db.get(`SELECT COUNT(*) as count FROM tenants WHERE status = 'active'`);

    return res.status(200).json({
      success: true,
      data: {
        revenue_trend,
        churn_trend,
        totals: { current_active_clinics: (activeClinicsRow && activeClinicsRow.count) || 0 }
      }
    });
  } catch (error) {
    console.error('Error building revenue/churn report:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء إعداد التقرير" }
    });
  }
});

/**
 * ==========================================
 * Broadcast messaging to all tenant owners
 * ==========================================
 */

/**
 * POST /admin/v1/broadcast
 * Send a message to all (optionally filtered) tenant owners via email and/or in-app notification
 */
router.post('/admin/v1/broadcast', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  const { subject, message, filter_plan = 'all', filter_status = 'all', channel = 'both' } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "العنوان والرسالة مطلوبان" } });
  }
  if (!['email', 'in_app', 'both'].includes(channel)) {
    return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "قناة الإرسال غير صالحة" } });
  }

  try {
    const params = [];
    let where = '1=1';
    if (filter_plan !== 'all') { where += ' AND t.subscription_plan = ?'; params.push(filter_plan); }
    if (filter_status !== 'all') { where += ' AND t.status = ?'; params.push(filter_status); }

    const recipients = await db.all(
      `SELECT t.id as tenant_id, t.name as tenant_name, u.id as user_id, u.email, u.full_name
       FROM tenants t JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
       WHERE ${where}`,
      params
    );

    recipients.forEach(r => {
      if (channel !== 'in_app') {
        emailService.notifyBroadcastMessage({
          tenant: { name: r.tenant_name },
          owner: { email: r.email, full_name: r.full_name },
          subject,
          message
        }).catch(e => console.error('Broadcast email error:', e));
      }
      if (channel !== 'email') {
        notificationService.createNotification({
          tenantId: r.tenant_id,
          userId: r.user_id,
          title: subject,
          message,
          type: 'info'
        }).catch(e => console.error('Broadcast in-app notification error:', e));
      }
    });

    const logId = `bcast-${Math.random().toString(36).substring(2, 10)}`;
    await db.run(
      `INSERT INTO admin_broadcast_logs (id, admin_id, subject, message, filter_plan, filter_status, channel, recipient_count) VALUES (?,?,?,?,?,?,?,?)`,
      [logId, req.user.id, subject, message, filter_plan, filter_status, channel, recipients.length]
    );
    await logAdminAction(req.user.id, 'broadcast.send', 'broadcast', logId, { subject, filter_plan, filter_status, channel, recipient_count: recipients.length }, req);

    return res.status(200).json({ success: true, data: { recipient_count: recipients.length } });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء إرسال البث الجماعي" }
    });
  }
});

/**
 * GET /admin/v1/broadcast/history
 * Last 20 broadcasts sent, with operator name resolved
 */
router.get('/admin/v1/broadcast/history', requireAdminRole('admin', 'super_admin'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT b.*, a.full_name as operator_name FROM admin_broadcast_logs b
       LEFT JOIN admin_users a ON a.id = b.admin_id ORDER BY b.created_at DESC LIMIT 20`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching broadcast history:', error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "حدث خطأ أثناء جلب سجل البث الجماعي" }
    });
  }
});

module.exports = router;
