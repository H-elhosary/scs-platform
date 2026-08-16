// ==========================================
// Smart Clinic OS (SCS) Platform Ops Controller
// Manages tickets, complaints, and requests
// ==========================================

const API_BASE_URL = 'http://localhost:3000';

let token = sessionStorage.getItem('ops_token');
let allTickets = [];
let selectedTicket = null;

// Security check: Redirect if no token
if (!token) {
  sessionStorage.removeItem('ops_token');
  window.location.href = 'index.html';
}

// Check session function (to prevent unauthorized stays)
function checkAuth() {
  if (!token) {
    window.location.href = 'index.html';
  }
}

// Fetch all tickets from backend
async function fetchTickets() {
  checkAuth();
  const tbody = document.getElementById('admin-tickets-table-body');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tickets`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('ops_token');
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    if (data.success) {
      allTickets = data.data;
      renderTicketsTable(allTickets);
    } else {
      showToast('فشل تحميل تذاكر الدعم الفني', 'error');
    }
  } catch (err) {
    console.error('Fetch tickets error:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="loading-text text-danger" style="text-align:center; padding:24px;">فشل الاتصال بالخادم.</td></tr>';
  }
}

// Render tickets inside table
function renderTicketsTable(tickets) {
  const tbody = document.getElementById('admin-tickets-table-body');
  if (!tbody) return;

  if (tickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-text" style="text-align:center; padding:24px; color:var(--text-muted);">لا توجد تذاكر أو طلبات مطابقة للفلاتر الحالية.</td></tr>';
    return;
  }

  const statusLabels = {
    pending: "قيد الانتظار",
    processing: "جاري المعالجة",
    resolved: "مكتمل ومحلول",
    rejected: "مرفوض"
  };

  const statusClasses = {
    pending: "status-confirmed", // yellow
    processing: "status-pending",  // blue
    resolved: "status-completed", // green
    rejected: "status-cancelled"   // red
  };

  tbody.innerHTML = tickets.map(t => {
    const formattedDate = new Date(t.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const pillClass = statusClasses[t.status] || 'status-pending';

    return `
      <tr>
        <td style="padding:12px 16px; font-family:Outfit; font-weight:700; color:var(--text-accent-blue);">${t.id}</td>
        <td style="padding:12px 16px; font-weight:600; color:var(--text-main);">${t.tenant_name}</td>
        <td style="padding:12px 16px;"><span class="tag-pill">${t.type_ar}</span></td>
        <td style="padding:12px 16px; font-weight:600; color:var(--text-main);">${t.title}</td>
        <td style="padding:12px 16px; font-size:11px; color:var(--text-muted);">${formattedDate}</td>
        <td style="padding:12px 16px;"><span class="status-pill ${pillClass}">${statusLabels[t.status]}</span></td>
        <td style="padding:12px 16px;">
          <button class="btn-primary small-btn" onclick="openRespondModal('${t.id}')" style="font-family:Cairo; font-size:11px; padding:6px 12px; cursor:pointer;">
            <i class="fa-solid fa-reply"></i> الرد والتحديث
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter tickets locally based on type and status selects
function filterTickets() {
  const statusFilter = document.getElementById('filter-ticket-status').value;
  const typeFilter = document.getElementById('filter-ticket-type').value;

  let filtered = allTickets;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(t => t.status === statusFilter);
  }

  if (typeFilter !== 'all') {
    filtered = filtered.filter(t => t.type === typeFilter);
  }

  renderTicketsTable(filtered);
}

// Open Respond Modal
function openRespondModal(ticketId) {
  const ticket = allTickets.find(t => t.id === ticketId);
  if (!ticket) return;

  selectedTicket = ticket;

  document.getElementById('modal-tkt-id').textContent = ticket.id;
  document.getElementById('modal-tkt-clinic').textContent = ticket.tenant_name;
  document.getElementById('modal-tkt-type').textContent = ticket.type_ar;
  document.getElementById('modal-tkt-title').textContent = ticket.title;
  document.getElementById('modal-tkt-desc').textContent = ticket.description;

  document.getElementById('update-tkt-status').value = ticket.status;
  document.getElementById('update-tkt-notes').value = ticket.response_notes || '';

  const modal = document.getElementById('respond-ticket-modal');
  if (modal) modal.classList.remove('hide');
}

// Close Respond Modal
function closeRespondModal() {
  selectedTicket = null;
  const modal = document.getElementById('respond-ticket-modal');
  if (modal) modal.classList.add('hide');
}

// Submit ticket response
async function submitTicketResponse(e) {
  e.preventDefault();
  if (!selectedTicket) return;

  const status = document.getElementById('update-tkt-status').value;
  const responseNotes = document.getElementById('update-tkt-notes').value.trim();

  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tickets/${selectedTicket.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: status,
        response_notes: responseNotes
      })
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('ops_token');
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('تم تحديث حالة الطلب وإرسال الرد بنجاح', 'success');
      closeRespondModal();
      fetchTickets();
    } else {
      showToast(data.error.message || 'فشل تحديث الطلب', 'error');
    }
  } catch (err) {
    console.error('Submit response error:', err);
    showToast('حدث خطأ أثناء الاتصال بالخادم لحفظ التغييرات.', 'error');
  }
}

// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid ${iconMap[type] || 'fa-info'}"></i></div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Logout Operator
function logoutAdmin() {
  sessionStorage.removeItem('ops_token');
  window.location.href = 'index.html';
}

// Initialization on load
document.addEventListener('DOMContentLoaded', () => {
  fetchTickets();
  
  // Set operator info if present
  const adminName = sessionStorage.getItem('ops_admin_name') || 'مشغل النظام';
  const adminRole = sessionStorage.getItem('ops_admin_role') || 'Super Admin';
  
  const opNameEl = document.getElementById('operator-name');
  const opRoleEl = document.getElementById('operator-role');
  if (opNameEl) opNameEl.textContent = adminName;
  if (opRoleEl) opRoleEl.textContent = adminRole;
});
