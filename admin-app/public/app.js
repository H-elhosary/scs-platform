// ==========================================
// Smart Clinic OS (SCS) — Admin/Ops Login Controller
// Operator-only: Login + 2FA → admin.html
// ==========================================

const API_BASE_URL = '';  // Same server — relative URL

let currentTab = 'operator'; // Always operator
let currentLang = 'en';
let tempToken = '';
let accessToken = '';
let lastLoginData = null;

const translations = {
  ar: {
    badge_text: "لوحة تحكم عمليات المنصة",
    left_title: "إدارة عيادات ومنصة SCS",
    left_desc: "إدارة العيادات، خطط الاشتراكات، والتحكم بصلاحيات الوصول من لوحة عمليات واحدة.",
    brand_sub: "لوحة عمليات المنصة",
    login_title_operator: "تسجيل دخول الأوبريشن",
    login_desc_operator: "بوابة تشغيل وإدارة منصة عيادتي الذكية (VPN)",
    label_email: "البريد الإلكتروني",
    label_password: "كلمة المرور",
    btn_login: "تسجيل الدخول",
    btn_verify: "تأكيد الرمز والدخول",
    btn_back: "العودة لشاشة الدخول",
    btn_logout: "تسجيل الخروج",
    otp_title: "رمز التحقق الثنائي (2FA)",
    otp_desc: "تم إرسال كود التحقق إلى بريدك الإلكتروني. الرجاء إدخال الرمز لتأكيد هويتك.",
    otp_console_notice: "تم طباعة الكود (123456) في Console الخادم والـ Browser لتسهيل التجربة.",
    success_title: "تم تسجيل الدخول بنجاح!",
    welcome_operator: "مرحباً بك {name} في لوحة التحكم الإدارية للمنصة!",
    err_network: "فشل الاتصال بالخادم. تأكد من تشغيل السيرفر.",
    lang_toggle: "English"
  },
  en: {
    badge_text: "Platform Ops Console",
    left_title: "SCS Platform Management",
    left_desc: "Manage clinics, subscription plans, and access control from a single operations dashboard.",
    brand_sub: "Platform Operations Console",
    login_title_operator: "Operations Portal Login",
    login_desc_operator: "Management and operation console of Smart Clinic OS (VPN)",
    label_email: "Email Address",
    label_password: "Password",
    btn_login: "Sign In",
    btn_verify: "Confirm Code & Verify",
    btn_back: "Back to Login",
    btn_logout: "Log Out",
    otp_title: "Two-Factor Auth (2FA)",
    otp_desc: "A verification code has been sent to your email. Please enter the code to confirm identity.",
    otp_console_notice: "The verification code (123456) is printed in the server and browser console for easy testing.",
    success_title: "Successfully Logged In!",
    welcome_operator: "Welcome {name} to the platform administration console!",
    err_network: "Failed to connect to server. Make sure the server is running.",
    lang_toggle: "العربية"
  }
};

// --- DOM Elements ---
const langToggleBtn = document.getElementById('lang-toggle-btn');
const langToggleText = langToggleBtn.querySelector('.lang-text');
const authTabs = document.getElementById('auth-tabs');
const tabButtons = authTabs.querySelectorAll('.tab-btn');

const loginStage = document.getElementById('login-stage');
const otpStage = document.getElementById('otp-stage');
const successStage = document.getElementById('success-stage');

const loginForm = document.getElementById('login-form');
const otpForm = document.getElementById('otp-form');
const otpInputs = document.querySelectorAll('.otp-digit');
const tokenDisplayBox = document.getElementById('token-display-box');
const userWelcomeMsg = document.getElementById('success-user-welcome');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const stageTitle = document.getElementById('stage-title');
const stageDesc = document.getElementById('stage-desc');

// --- Language Toggle ---
langToggleBtn.addEventListener('click', () => {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
  applyTranslation();
  updateStageText();
});

// --- Login Form Submit ---
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
    hideLoading('login-submit-btn', 'btn_login');

    if (data.success) {
      if (data.data.two_factor_required) {
        tempToken = data.data.temp_token;
        console.log(`🔑 2FA Session Temp Token: ${tempToken}`);
        console.log(`ℹ️ Use mock OTP code: 123456 to verify.`);
        switchStage('otp');
      }
    } else {
      showAlert(data.error.message);
    }
  } catch (error) {
    hideLoading('login-submit-btn', 'btn_login');
    showAlert(translations[currentLang].err_network);
    console.error('Network Error:', error);
  }
});

// --- OTP Inputs ---
otpInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => { if (e.target.value.length === 1 && index < otpInputs.length - 1) otpInputs[index + 1].focus(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) otpInputs[index - 1].focus(); });
});

// --- OTP Form Submit ---
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
    hideLoading('otp-submit-btn', 'btn_verify');

    if (data.success) {
      sessionStorage.setItem('ops_token', data.data.access_token);
      window.location.href = 'admin.html';
    } else {
      showAlert(data.error.message);
      otpInputs.forEach(input => input.value = '');
      otpInputs[0].focus();
    }
  } catch (error) {
    hideLoading('otp-submit-btn', 'btn_verify');
    showAlert(translations[currentLang].err_network);
  }
});

document.getElementById('otp-back-btn').addEventListener('click', () => { hideAlert(); switchStage('login'); });
document.getElementById('logout-btn').addEventListener('click', () => { accessToken = ''; tempToken = ''; emailInput.value = ''; passwordInput.value = ''; otpInputs.forEach(input => input.value = ''); hideAlert(); switchStage('login'); });

// --- Helpers ---
function switchStage(stage) {
  loginStage.classList.add('hide');
  otpStage.classList.add('hide');
  successStage.classList.add('hide');
  if (stage === 'login') loginStage.classList.remove('hide');
  else if (stage === 'otp') { otpStage.classList.remove('hide'); otpInputs[0].focus(); }
  else if (stage === 'success') successStage.classList.remove('hide');
}

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

function showAlert(message) { showToast(message, 'error'); }
function hideAlert() { }

function updateStageText() {
  stageTitle.innerText = translations[currentLang].login_title_operator;
  stageDesc.innerText = translations[currentLang].login_desc_operator;
}

function applyTranslation() {
  document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.dataset.i18n; if (translations[currentLang][key]) el.innerText = translations[currentLang][key]; });
  langToggleText.innerText = translations[currentLang].lang_toggle;
}

function showLoading(btnId) { const btn = document.getElementById(btnId); btn.disabled = true; btn.querySelector('.btn-text').classList.add('hide'); btn.querySelector('.spinner').classList.remove('hide'); }
function hideLoading(btnId, i18nKey) { const btn = document.getElementById(btnId); btn.disabled = false; btn.querySelector('.btn-text').classList.remove('hide'); btn.querySelector('.spinner').classList.add('hide'); btn.querySelector('.btn-text').innerText = translations[currentLang][i18nKey]; }

document.addEventListener('DOMContentLoaded', () => {
  const btnCopyToken = document.getElementById('btn-copy-token');
  if (btnCopyToken) {
    btnCopyToken.addEventListener('click', () => {
      navigator.clipboard.writeText(tokenDisplayBox.innerText).then(() => {
        showToast('JWT Token copied!', 'success');
      });
    });
  }
});

applyTranslation();
updateStageText();
