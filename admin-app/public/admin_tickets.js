// ==========================================
// Smart Clinic OS (SCS) — Ops Tickets Controller
// Auth, sidebar, toast/modal helpers come from core/ops-shared.js.
// ==========================================

let allTickets = [];
let allAssignees = [];
let selectedTicket = null;

document.addEventListener('opsShellReady', () => {
  fetchAssignees();
  fetchTickets();
});

async function fetchAssignees() {
  try {
    const res = await opsFetch('/admin/v1/admin-users/assignable');
    const data = await res.json();
    if (!data.success) return;
    allAssignees = data.data || [];

    const filterSel = document.getElementById('filter-ticket-assignee');
    const modalSel = document.getElementById('update-tkt-assignee');
    allAssignees.forEach(a => {
      const opt1 = document.createElement('option');
      opt1.value = a.id; opt1.textContent = a.full_name;
      filterSel.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = a.id; opt2.textContent = a.full_name;
      modalSel.appendChild(opt2);
    });
  } catch (err) {
    console.warn('Failed to load assignable operators:', err);
  }
}

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
    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:24px; color:var(--scs-danger);">فشل الاتصال بالخادم.</td></tr>';
  }
}

const statusLabels = { pending: 'قيد الانتظار', processing: 'جاري المعالجة', resolved: 'مكتمل ومحلول', rejected: 'مرفوض' };
const statusPillClass = { pending: 'status-pending', processing: 'status-processing', resolved: 'status-resolved', rejected: 'status-rejected' };
const priorityLabels = { urgent: 'عاجل', high: 'مرتفعة', normal: 'عادية', low: 'منخفضة' };

function renderTicketsTable(tickets) {
  const tbody = document.getElementById('admin-tickets-table-body');
  if (tickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:24px; color:var(--scs-text-muted);">لا توجد تذاكر أو طلبات مطابقة للفلاتر الحالية.</td></tr>';
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const formattedDate = t.created_at ? new Date(t.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const pillClass = statusPillClass[t.status] || 'status-pending';
    const priority = t.priority || 'normal';
    const isOverdue = t.due_at && new Date(t.due_at) < new Date() && !['resolved', 'rejected'].includes(t.status);
    const dueClass = isOverdue ? 'expiry-warning expired' : (t.due_at ? 'expiry-warning soon' : '');
    const dueText = t.due_at ? new Date(t.due_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    return `
      <tr>
        <td style="font-family:var(--scs-font-en); font-weight:700; color:var(--primary);">${escapeHtml(t.id)}</td>
        <td style="font-weight:600; color:var(--scs-text-heading);">${escapeHtml(t.tenant_name || '—')}</td>
        <td><span class="tag-pill">${escapeHtml(t.type_ar || t.type)}</span></td>
        <td style="font-weight:600; color:var(--scs-text-heading);">${escapeHtml(t.title)}</td>
        <td><span class="priority-pill priority-${priority}">${priorityLabels[priority] || priority}</span>${t.due_at ? `<div class="${dueClass}" style="font-size:10.5px; margin-top:3px;">${dueText}</div>` : ''}</td>
        <td style="font-size:12px; color:var(--scs-text-label);">${escapeHtml(t.assignee_name || 'غير مُسند')}</td>
        <td style="font-size:11.5px; color:var(--scs-text-muted);">${formattedDate}</td>
        <td><span class="status-pill ${pillClass}">${statusLabels[t.status] || t.status}</span></td>
        <td><button class="btn-outline-cta" style="font-size:11.5px; padding:6px 12px;" onclick="openRespondModal('${t.id}')"><i class="fa-solid fa-reply"></i> الرد والتحديث</button></td>
      </tr>`;
  }).join('');
}

function filterTickets() {
  const statusFilter = document.getElementById('filter-ticket-status').value;
  const typeFilter = document.getElementById('filter-ticket-type').value;
  const priorityFilter = document.getElementById('filter-ticket-priority').value;
  const assigneeFilter = document.getElementById('filter-ticket-assignee').value;
  let filtered = allTickets;
  if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  if (priorityFilter !== 'all') filtered = filtered.filter(t => (t.priority || 'normal') === priorityFilter);
  if (assigneeFilter === 'unassigned') filtered = filtered.filter(t => !t.assigned_to);
  else if (assigneeFilter !== 'all') filtered = filtered.filter(t => t.assigned_to === assigneeFilter);
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
  document.getElementById('update-tkt-priority').value = ticket.priority || 'normal';
  document.getElementById('update-tkt-assignee').value = ticket.assigned_to || '';
  document.getElementById('update-tkt-notes').value = ticket.response_notes || '';

  openModal('respond-ticket-modal');
}

async function submitTicketResponse(e) {
  e.preventDefault();
  if (!selectedTicket) return;

  const status = document.getElementById('update-tkt-status').value;
  const priority = document.getElementById('update-tkt-priority').value;
  const assigned_to = document.getElementById('update-tkt-assignee').value || undefined;
  const responseNotes = document.getElementById('update-tkt-notes').value.trim();

  try {
    const res = await opsFetch(`/admin/v1/tickets/${selectedTicket.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, response_notes: responseNotes, priority, assigned_to })
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

document.getElementById('export-tickets-csv-btn')?.addEventListener('click', () => {
  const headers = ['رقم الطلب', 'العيادة', 'نوع الطلب', 'العنوان', 'الأولوية', 'المسؤول', 'الحالة', 'تاريخ التقديم'];
  const rows = allTickets.map(t => [
    t.id, t.tenant_name || '', t.type_ar || t.type || '', t.title || '',
    priorityLabels[t.priority || 'normal'] || t.priority || '', t.assignee_name || 'غير مُسند',
    statusLabels[t.status] || t.status || '', t.created_at || ''
  ]);
  exportTableToCSV(`tickets-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
});
