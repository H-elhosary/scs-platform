// ==========================================
// Smart Clinic OS (SCS) — Ops Team Management Controller
// Auth, sidebar, toast/modal helpers come from core/ops-shared.js.
// Server-side requireAdminRole('super_admin') is the real enforcement;
// this page is only reachable/usable client-side for super_admin operators.
// ==========================================

let allOperators = [];

document.addEventListener('opsShellReady', () => {
  fetchOperators();
});

const roleLabels = { super_admin: 'Super Admin', admin: 'Admin', support: 'Support' };
const roleBadgeClass = { super_admin: 'plan-badge plan-enterprise', admin: 'plan-badge plan-pro', support: 'plan-badge plan-basic' };

async function fetchOperators() {
  const tbody = document.getElementById('operators-table-body');
  try {
    const res = await opsFetch('/admin/v1/admin-users');
    const data = await res.json();
    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:24px; color:var(--scs-danger);">${escapeHtml(data.error?.message || 'فشل تحميل فريق العمليات')}</td></tr>`;
      return;
    }
    allOperators = data.data;
    renderOperatorsTable();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:24px; color:var(--scs-danger);">فشل الاتصال بالخادم.</td></tr>';
  }
}

function renderOperatorsTable() {
  const tbody = document.getElementById('operators-table-body');
  if (allOperators.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:24px; color:var(--scs-text-muted);">لا يوجد مشغلون مسجلون بعد.</td></tr>';
    return;
  }

  tbody.innerHTML = allOperators.map(op => {
    const statusBadge = op.status === 'active'
      ? `<span class="status-active-badge"><i class="fa-solid fa-circle-check"></i> نشط</span>`
      : `<span class="status-suspended-badge"><i class="fa-solid fa-circle-pause"></i> موقوف</span>`;
    const createdDate = op.created_at ? new Date(op.created_at).toLocaleDateString('ar-EG') : '—';
    const toggleLabel = op.status === 'active' ? 'إيقاف' : 'تفعيل';

    return `
      <tr>
        <td style="font-weight:700; color:var(--scs-text-heading);">${escapeHtml(op.full_name)}</td>
        <td style="font-family:var(--scs-font-en); font-size:12.5px;">${escapeHtml(op.email)}</td>
        <td><span class="${roleBadgeClass[op.role] || 'plan-badge plan-basic'}">${roleLabels[op.role] || op.role}</span></td>
        <td>${statusBadge}</td>
        <td style="font-size:11.5px; color:var(--scs-text-muted);">${createdDate}</td>
        <td style="text-align:center; white-space:nowrap;">
          <button class="btn-outline-cta" style="font-size:11px; padding:6px 10px;" onclick="openEditOperatorModal('${op.id}')"><i class="fa-solid fa-pen"></i> تعديل</button>
          <button class="btn-outline-cta" style="font-size:11px; padding:6px 10px; color:var(--scs-warning); border-color:#fde68a;" onclick="toggleOperatorStatus('${op.id}', '${op.status === 'active' ? 'inactive' : 'active'}')">${toggleLabel}</button>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('add-operator-btn')?.addEventListener('click', () => {
  document.getElementById('operator-form').reset();
  document.getElementById('operator-id').value = '';
  document.getElementById('operator-modal-title').innerText = 'إضافة مشغل جديد';
  document.getElementById('operator-email').removeAttribute('readonly');
  document.getElementById('operator-password-group').style.display = '';
  document.getElementById('operator-password').setAttribute('required', 'true');
  document.getElementById('operator-status-group').style.display = 'none';
  document.getElementById('operator-role').value = 'support';
  openModal('operator-modal');
});

function openEditOperatorModal(id) {
  const op = allOperators.find(o => o.id === id);
  if (!op) return;

  document.getElementById('operator-form').reset();
  document.getElementById('operator-id').value = op.id;
  document.getElementById('operator-modal-title').innerText = 'تعديل بيانات المشغل';
  document.getElementById('operator-full-name').value = op.full_name;
  document.getElementById('operator-email').value = op.email;
  document.getElementById('operator-email').setAttribute('readonly', 'true');
  document.getElementById('operator-password-group').style.display = 'none';
  document.getElementById('operator-password').removeAttribute('required');
  document.getElementById('operator-status-group').style.display = '';
  document.getElementById('operator-status').value = op.status;
  document.getElementById('operator-role').value = op.role;
  openModal('operator-modal');
}

async function toggleOperatorStatus(id, newStatus) {
  if (!confirm(newStatus === 'inactive' ? 'هل تريد إيقاف هذا المشغل؟ لن يتمكن من الدخول للوحة التحكم بعد ذلك.' : 'هل تريد إعادة تفعيل هذا المشغل؟')) return;
  try {
    const res = await opsFetch(`/admin/v1/admin-users/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
    const data = await res.json();
    if (data.success) {
      showToast('تم تحديث حالة المشغل بنجاح', 'success');
      fetchOperators();
    } else {
      showToast(data.error?.message || 'فشل تحديث الحالة', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  }
}

document.getElementById('operator-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('operator-id').value;
  const full_name = document.getElementById('operator-full-name').value.trim();
  const email = document.getElementById('operator-email').value.trim();
  const password = document.getElementById('operator-password').value;
  const role = document.getElementById('operator-role').value;
  const isEdit = !!id;

  showLoading('operator-submit-btn');
  try {
    let res;
    if (isEdit) {
      const status = document.getElementById('operator-status').value;
      res = await opsFetch(`/admin/v1/admin-users/${id}`, { method: 'PUT', body: JSON.stringify({ full_name, role, status }) });
    } else {
      res = await opsFetch('/admin/v1/admin-users', { method: 'POST', body: JSON.stringify({ full_name, email, password, role }) });
    }
    const data = await res.json();
    if (data.success) {
      showToast(isEdit ? 'تم تحديث بيانات المشغل بنجاح' : 'تم إضافة المشغل بنجاح', 'success');
      closeModal('operator-modal');
      fetchOperators();
    } else {
      showToast(data.error?.message || 'فشلت العملية', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  } finally {
    hideLoading('operator-submit-btn', 'حفظ');
  }
});
