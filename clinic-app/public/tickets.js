// Support Tickets Page Specific Logic
document.addEventListener('sharedDataReady', () => {
  loadTickets();
});

async function loadTickets() {
  try {
    const res = await fetch(`${API_BASE}/v1/tickets`).then(r => r.json());
    if (res.success) {
      renderTickets(res.data);
    }
  } catch (e) {
    showToast('فشل تحميل تذاكر الدعم الفني', 'error');
  }
}

function renderTickets(tickets) {
  // Update stats
  const total = tickets.length;
  const pending = tickets.filter(t => t.status === 'pending').length;
  const processing = tickets.filter(t => t.status === 'processing').length;
  const resolved = tickets.filter(t => t.status === 'resolved').length;

  document.getElementById('tkt-stat-total').textContent = total;
  document.getElementById('tkt-stat-pending').textContent = pending;
  document.getElementById('tkt-stat-processing').textContent = processing;
  document.getElementById('tkt-stat-resolved').textContent = resolved;

  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;

  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">لا توجد طلبات دعم مقدمة مسبقاً.</td></tr>';
    return;
  }

  const typeLabels = { renew: 'تجديد اشتراك', upgrade: 'ترقية الباقة', maintenance: 'صيانة ودعم فني', complaint: 'شكوى / مقترح' };
  const statusLabels = { pending: 'قيد الانتظار', processing: 'جاري المعالجة', resolved: 'تم الحل' };
  const statusClasses = { pending: 'status-pending', processing: 'status-checked_in', resolved: 'status-completed' };

  tbody.innerHTML = tickets.map(t => {
    return `
      <tr>
        <td><strong style="color:#38bdf8; font-family:Outfit;">${t.id}</strong></td>
        <td>${typeLabels[t.type] || t.type}</td>
        <td><strong>${t.title}</strong></td>
        <td><span style="font-family:Outfit; font-size:11px;">${t.created_at || '—'}</span></td>
        <td><span class="status-pill ${statusClasses[t.status]}">${statusLabels[t.status] || t.status}</span></td>
        <td>
          <button class="btn-action btn-outline-cta" onclick="viewTicketDetails('${t.id}')">
            <i class="fa-solid fa-eye"></i> عرض الطلب
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function submitNewTicket(e) {
  e.preventDefault();
  try {
    const res = await fetch(`${API_BASE}/v1/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: document.getElementById('new-tkt-type').value,
        title: document.getElementById('new-tkt-title').value,
        description: document.getElementById('new-tkt-description').value
      })
    }).then(r => r.json());

    if (res.success) {
      showToast('تم إرسال طلبك بنجاح وسيتصل بك الدعم الفني قريباً', 'success');
      closeModal('modal-new-ticket');
      
      // Reset form
      document.getElementById('new-tkt-title').value = '';
      document.getElementById('new-tkt-description').value = '';
      
      loadTickets();
    }
  } catch (e) {
    showToast('فشل إرسال طلب الدعم', 'error');
  }
}

async function viewTicketDetails(ticketId) {
  try {
    const res = await fetch(`${API_BASE}/v1/tickets/${ticketId}`).then(r => r.json());
    if (res.success) {
      const t = res.data;
      
      const typeLabels = { renew: 'تجديد اشتراك', upgrade: 'ترقية الباقة', maintenance: 'صيانة ودعم فني', complaint: 'شكوى / مقترح' };
      const statusLabels = { pending: 'قيد الانتظار', processing: 'جاري المعالجة', resolved: 'تم الحل' };
      const statusClasses = { pending: 'status-pending', processing: 'status-checked_in', resolved: 'status-completed' };

      document.getElementById('view-tkt-id').textContent = t.id;
      
      const statusPill = document.getElementById('view-tkt-status-pill');
      statusPill.textContent = statusLabels[t.status] || t.status;
      statusPill.className = `status-pill ${statusClasses[t.status]}`;
      
      document.getElementById('view-tkt-type').textContent = typeLabels[t.type] || t.type;
      document.getElementById('view-tkt-title').textContent = t.title;
      document.getElementById('view-tkt-description').textContent = t.description;
      
      const responseEl = document.getElementById('view-tkt-response');
      responseEl.textContent = t.response || 'لم تقم إدارة المنصة بالرد على هذا الطلب بعد.';
      
      openModal('modal-view-ticket');
    }
  } catch (e) {
    showToast('فشل تحميل تفاصيل التذكرة', 'error');
  }
}
