// ==========================================
// Smart Clinic OS (SCS) — Broadcast Messaging Controller
// Auth, sidebar, toast/modal helpers come from core/ops-shared.js.
// ==========================================

document.addEventListener('opsShellReady', () => {
  loadPlansForFilter();
  loadBroadcastHistory();
});

async function loadPlansForFilter() {
  try {
    const res = await opsFetch('/admin/v1/plans');
    const data = await res.json();
    if (!data.success) return;
    const sel = document.getElementById('bcast-filter-plan');
    data.data.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.warn('Failed to load plans for broadcast filter:', err);
  }
}

async function loadBroadcastHistory() {
  const container = document.getElementById('broadcast-history-container');
  try {
    const res = await opsFetch('/admin/v1/broadcast/history');
    const data = await res.json();
    if (!data.success) {
      container.innerHTML = `<p style="text-align:center; color:var(--scs-danger); padding:20px 0;">${escapeHtml(data.error?.message || 'فشل تحميل السجل')}</p>`;
      return;
    }
    if (data.data.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--scs-text-muted); padding:20px 0;">لم يتم إرسال أي بث جماعي حتى الآن.</p>';
      return;
    }
    const channelLabels = { email: 'بريد فقط', in_app: 'إشعار داخلي فقط', both: 'بريد + إشعار داخلي' };
    container.innerHTML = data.data.map(b => `
      <div class="timeline-item">
        <div class="timeline-badge"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-action">${escapeHtml(b.subject)}</span>
            <span class="timeline-date">${new Date(b.created_at).toLocaleString('ar-EG')}</span>
          </div>
          <p style="white-space:pre-wrap;">${escapeHtml((b.message || '').slice(0, 160))}${(b.message || '').length > 160 ? '…' : ''}</p>
          <p><strong>المستلمون:</strong> ${b.recipient_count} عيادة — <strong>القناة:</strong> ${channelLabels[b.channel] || b.channel}</p>
          <div class="timeline-operator">بواسطة: ${escapeHtml(b.operator_name || 'مشغل النظام')}</div>
        </div>
      </div>`).join('');
  } catch (error) {
    container.innerHTML = '<p style="text-align:center; color:var(--scs-danger); padding:20px 0;">فشل الاتصال بالخادم.</p>';
  }
}

document.getElementById('broadcast-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const subject = document.getElementById('bcast-subject').value.trim();
  const message = document.getElementById('bcast-message').value.trim();
  const filter_plan = document.getElementById('bcast-filter-plan').value;
  const filter_status = document.getElementById('bcast-filter-status').value;
  const channel = document.querySelector('input[name="bcast-channel"]:checked').value;

  if (!confirm('هل أنت متأكد من إرسال هذا البث؟ سيتم إرساله فوراً لكل العيادات المطابقة للفلاتر المحددة.')) return;

  showLoading('broadcast-submit-btn');
  try {
    const res = await opsFetch('/admin/v1/broadcast', {
      method: 'POST',
      body: JSON.stringify({ subject, message, filter_plan, filter_status, channel })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`تم إرسال البث بنجاح إلى ${data.data.recipient_count} عيادة`, 'success');
      document.getElementById('broadcast-form').reset();
      loadBroadcastHistory();
    } else {
      showToast(data.error?.message || 'فشل إرسال البث', 'error');
    }
  } catch (error) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  } finally {
    hideLoading('broadcast-submit-btn', 'إرسال البث الجماعي');
  }
});
