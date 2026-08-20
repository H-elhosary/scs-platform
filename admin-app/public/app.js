// ==========================================
// Smart Clinic OS (SCS) — Ops Login Controller
// Operator login + 2FA → admin.html
// ==========================================

const API_BASE_URL = '';
let tempToken = '';

const loginStage = document.getElementById('login-stage');
const otpStage = document.getElementById('otp-stage');
const loginForm = document.getElementById('login-form');
const otpForm = document.getElementById('otp-form');
const otpInputs = document.querySelectorAll('.otp-digit');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const alertPanel = document.getElementById('alert-panel');
const alertMsg = document.getElementById('alert-msg');

function showAlert(message) {
  alertMsg.innerText = message;
  alertPanel.classList.remove('hide');
}
function hideAlert() {
  alertPanel.classList.add('hide');
}

function showLoading(btnId) {
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hide');
  btn.querySelector('.spinner').classList.remove('hide');
}
function hideLoading(btnId, restoreText) {
  const btn = document.getElementById(btnId);
  btn.disabled = false;
  const textEl = btn.querySelector('.btn-text');
  textEl.classList.remove('hide');
  if (restoreText) textEl.innerText = restoreText;
  btn.querySelector('.spinner').classList.add('hide');
}

function switchStage(stage) {
  loginStage.classList.add('hide');
  otpStage.classList.add('hide');
  if (stage === 'login') {
    loginStage.classList.remove('hide');
  } else if (stage === 'otp') {
    otpStage.classList.remove('hide');
    otpInputs[0].focus();
  }
}

// Toast helper (kept local so this page works before core/ops-shared.js loads on other pages)
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
  toast.innerHTML = `<div class="toast-icon"><i class="${iconClass}"></i></div><div class="toast-content">${message}</div><button class="toast-close" type="button">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  toast.querySelector('.toast-close').addEventListener('click', () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); });
  setTimeout(() => { if (toast.parentNode) { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); } }, 4000);
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  showLoading('login-submit-btn');

  try {
    const response = await fetch(`${API_BASE_URL}/admin/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
    });
    const data = await response.json();
    hideLoading('login-submit-btn', 'تسجيل الدخول');

    if (data.success && data.data.two_factor_required) {
      tempToken = data.data.temp_token;
      console.log(`ℹ️ استخدم كود التحقق التجريبي: 123456`);
      switchStage('otp');
    } else {
      showAlert(data.error?.message || 'فشل تسجيل الدخول');
    }
  } catch (error) {
    hideLoading('login-submit-btn', 'تسجيل الدخول');
    showAlert('فشل الاتصال بالخادم. تأكد من تشغيل السيرفر.');
  }
});

otpInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    if (e.target.value.length === 1 && index < otpInputs.length - 1) otpInputs[index + 1].focus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) otpInputs[index - 1].focus();
  });
});

otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  showLoading('otp-submit-btn');

  let otpCode = '';
  otpInputs.forEach(input => { otpCode += input.value; });

  try {
    const response = await fetch(`${API_BASE_URL}/admin/v1/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token: tempToken, otp_code: otpCode })
    });
    const data = await response.json();
    hideLoading('otp-submit-btn', 'تأكيد الرمز والدخول');

    if (data.success) {
      sessionStorage.setItem('ops_token', data.data.access_token);
      window.location.href = 'admin.html';
    } else {
      showAlert(data.error?.message || 'كود التحقق غير صحيح');
      otpInputs.forEach(input => input.value = '');
      otpInputs[0].focus();
    }
  } catch (error) {
    hideLoading('otp-submit-btn', 'تأكيد الرمز والدخول');
    showAlert('فشل الاتصال بالخادم. تأكد من تشغيل السيرفر.');
  }
});

document.getElementById('otp-back-btn').addEventListener('click', () => {
  hideAlert();
  switchStage('login');
});

// If already logged in, skip straight to the dashboard.
if (sessionStorage.getItem('ops_token')) {
  window.location.href = 'admin.html';
}
