// ==========================================
// Smart Clinic OS (SCS) — Ops Tickets Controller
// Auth, sidebar, toast/modal helpers come from core/ops-shared.js.
// ==========================================

let allTickets = [];
let selectedTicket = null;

document.addEventListener('opsShellReady', () => {
  fetchTickets();
});

async function fetchTickets() {
  const tbody = document.getElementById('admin-tickets-table-body');
  try {
    const res = await opsFetch('/admin/v1/tickets');
    const data = await res.json();
    if (data.success) {
      allTickets = data.data;
      filterTickets();
    } else {
      showToast('فشل تحميل تذاكر الدعم الفني', 'error');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:24px; color:var(--scs-danger);">فشل الاتصال بالخادم.</td></tr>';
  }
}

const statusLabels = { pending: 'قيد الانتظار', processing: 'جاري المعالجة', resolved: 'مكتمل ومحلول', rejected: 'مرفوض' };
const statusPillClass = { pending: 'status-pending', processing: 'status-processing', resolved: 'status-resolved', rejected: 'status-rejected' };

function renderTicketsTable(tickets) {
  const tbody = document.getElementById('admin-tickets-table-body');
  if (tickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:24px; color:var(--scs-text-muted);">لا توجد تذاكر أو طلبات مطابقة للفلاتر الحالية.</td></tr>';
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const formattedDate = t.created_at ? new Date(t.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const pillClass = statusPillClass[t.status] || 'status-pending';
    return `
      <tr>
        <td style="font-family:var(--scs-font-en); font-weight:700; color:var(--primary);">${escapeHtml(t.id)}</td>
        <td style="font-weight:600; color:var(--scs-text-heading);">${escapeHtml(t.tenant_name || '—')}</td>
        <td><span class="tag-pill">${escapeHtml(t.type_ar || t.type)}</span></td>
        <td style="font-weight:600; color:var(--scs-text-heading);">${escapeHtml(t.title)}</td>
        <td style="font-size:11.5px; color:var(--scs-text-muted);">${formattedDate}</td>
        <td><span class="status-pill ${pillClass}">${statusLabels[t.status] || t.status}</span></td>
        <td><button class="btn-outline-cta" style="font-size:11.5px; padding:6px 12px;" onclick="openRespondModal('${t.id}')"><i class="fa-solid fa-reply"></i> الرد والتحديث</button></td>
      </tr>`;
  }).join('');
}

function filterTickets() {
  const statusFilter = document.getElementById('filter-ticket-status').value;
  const typeFilter = document.getElementById('filter-ticket-type').value;
  let filtered = allTickets;
  if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  renderTicketsTable(filtered);
}

function openRespondModal(ticketId) {
  const ticket = allTickets.find(t => t.id === ticketId);
  if (!ticket) return;
  selectedTicket = ticket;

  document.getElementById('modal-tkt-id').textContent = ticket.id;
  document.getElementById('modal-tkt-clinic').textContent = ticket.tenant_name;
  document.getElementById('modal-tkt-type').textContent = ticket.type_ar || ticket.type;
  document.getElementById('modal-tkt-title').textContent = ticket.title;
  document.getElementById('modal-tkt-desc').textContent = ticket.description;
  document.getElementById('update-tkt-status').value = ticket.status;
  document.getElementById('update-tkt-notes').value = ticket.response_notes || '';

  openModal('respond-ticket-modal');
}

async function submitTicketResponse(e) {
  e.preventDefault();
  if (!selectedTicket) return;

  const status = document.getElementById('update-tkt-status').value;
  const responseNotes = document.getElementById('update-tkt-notes').value.trim();

  try {
    const res = await opsFetch(`/admin/v1/tickets/${selectedTicket.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, response_notes: responseNotes })
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم تحديث حالة الطلب وإرسال الرد بنجاح', 'success');
      closeModal('respond-ticket-modal');
      fetchTickets();
    } else {
      showToast(data.error?.message || 'فشل تحديث الطلب', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء الاتصال بالخادم لحفظ التغييرات.', 'error');
  }
}
