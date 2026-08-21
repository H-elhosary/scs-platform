// ==========================================
// Smart Clinic OS (SCS) — Revenue/Churn Reports Controller
// Auth, sidebar, toast/modal helpers come from core/ops-shared.js.
// ==========================================

document.addEventListener('opsShellReady', () => {
  loadRevenueChurnReport();
});

async function loadRevenueChurnReport() {
  const revBody = document.getElementById('revenue-trend-body');
  const churnBody = document.getElementById('churn-trend-body');
  try {
    const res = await opsFetch('/admin/v1/reports/revenue-churn');
    const data = await res.json();
    if (!data.success) {
      revBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:20px; color:var(--scs-danger);">${escapeHtml(data.error?.message || 'فشل تحميل التقرير')}</td></tr>`;
      churnBody.innerHTML = '';
      return;
    }

    const { revenue_trend, churn_trend } = data.data;

    revBody.innerHTML = revenue_trend.length === 0
      ? '<tr><td colspan="5" class="text-center" style="padding:20px; color:var(--scs-text-muted);">لا توجد أحداث اشتراك مسجلة خلال آخر 12 شهراً.</td></tr>'
      : revenue_trend.map(r => `
        <tr>
          <td style="font-weight:700; color:var(--scs-text-heading);">${escapeHtml(r.month)}</td>
          <td>${r.basic}</td>
          <td>${r.pro}</td>
          <td>${r.enterprise}</td>
          <td style="font-weight:700; color:var(--primary);">$${r.proxy_value_usd}</td>
        </tr>`).join('');

    churnBody.innerHTML = churn_trend.length === 0
      ? '<tr><td colspan="4" class="text-center" style="padding:20px; color:var(--scs-text-muted);">لا توجد حالات تعليق أو تنشيط مسجلة خلال آخر 12 شهراً.</td></tr>'
      : churn_trend.map(c => `
        <tr>
          <td style="font-weight:700; color:var(--scs-text-heading);">${escapeHtml(c.month)}</td>
          <td style="color:var(--scs-danger); font-weight:700;">${c.suspensions || 0}</td>
          <td style="color:var(--scs-success); font-weight:700;">${c.reactivations || 0}</td>
          <td>${c.churn_rate_pct}%</td>
        </tr>`).join('');
  } catch (error) {
    revBody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:20px; color:var(--scs-danger);">فشل الاتصال بالخادم.</td></tr>';
    churnBody.innerHTML = '';
  }
}
