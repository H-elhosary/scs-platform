// =============================================
// Smart Clinic OS — Dashboard Routes (Real Database Mode)
// GET /v1/dashboard/stats
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../../db/connection');

// --- Dashboard Stats ---
router.get('/v1/dashboard/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    const todayAppts = await db.all(`SELECT * FROM appointments WHERE tenant_id = ? AND date = ?`, [tenantId, today]);
    const totalPatients = await db.get(`SELECT COUNT(*) as count FROM patients WHERE tenant_id = ?`, [tenantId]);
    const tenant = await db.get(`SELECT * FROM tenants WHERE id = ?`, [tenantId]);

    const completed = todayAppts.filter(a => a.status === 'completed');
    const checkedIn = todayAppts.filter(a => a.status === 'checked_in');
    const confirmed = todayAppts.filter(a => a.status === 'confirmed');
    const noShows = todayAppts.filter(a => a.status === 'no_show');

    const totalRevenue = todayAppts.filter(a => a.payment_status === 'paid').reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const onlineRevenue = todayAppts.filter(a => a.payment_status === 'paid' && a.payment_method === 'online').reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const cashRevenue = todayAppts.filter(a => a.payment_status === 'paid' && a.payment_method === 'cash').reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

    const activeConvs = await db.all(`SELECT COUNT(*) as count FROM conversations WHERE tenant_id = ? AND status IN ('active', 'manual_mode')`, [tenantId]);

    // Real last-7-days revenue breakdown (was 6 hardcoded numbers + today's
    // real value) — one GROUP BY query, then backfill any day with no paid
    // appointments to 0 rather than omitting it from the chart.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const revenueRows = await db.all(
      `SELECT date, SUM(amount) as revenue FROM appointments
       WHERE tenant_id = ? AND payment_status = 'paid' AND date >= ? AND date <= ?
       GROUP BY date`,
      [tenantId, sevenDaysAgoStr, today]
    );
    const revenueByDate = {};
    revenueRows.forEach(r => { revenueByDate[r.date] = parseFloat(r.revenue) || 0; });

    const weekdayLabels = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const weeklyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      weeklyRevenue.push({
        date: dStr,
        label: weekdayLabels[d.getDay()] + (i === 0 ? ' (اليوم)' : ''),
        revenue: revenueByDate[dStr] || 0
      });
    }

    return res.json({
      success: true,
      data: {
        today_date: today,
        tenant_id: tenantId,
        specialty: tenant?.specialty || 'dental',
        patients_today: todayAppts.length,
        completed_count: completed.length,
        checked_in_count: checkedIn.length,
        confirmed_count: confirmed.length,
        no_show_count: noShows.length,
        attendance_rate: todayAppts.length > 0
          ? Math.round(((completed.length + checkedIn.length) / ((completed.length + checkedIn.length + noShows.length) || 1)) * 100)
          : 0,
        total_revenue: totalRevenue,
        online_revenue: onlineRevenue,
        cash_revenue: cashRevenue,
        weekly_revenue: weeklyRevenue,
        new_patients_today: 1,
        total_patients: totalPatients?.count || 0,
        pending_approvals: todayAppts.filter(a => a.payment_status === 'pending_approval').length,
        active_conversations: activeConvs[0]?.count || 0,
        tenant_name: tenant?.name || "عيادة النور لطب الأسنان",
        allow_multi_doctor: tenant ? !!tenant.allow_multi_doctor : true,
        allow_insurance: tenant ? !!tenant.allow_insurance : false,
        allow_refunds: tenant ? !!tenant.allow_refunds : false
      }
    });
  } catch (err) {
    console.error('Failed to get dashboard stats:', err);
    return res.status(500).json({ success: false, error: { message: 'حدث خطأ في قاعدة البيانات' } });
  }
});

module.exports = router;
