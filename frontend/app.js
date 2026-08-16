// ==========================================
// Smart Clinic OS (SCS) — Clinic Login Controller
// Clinic-only: No operator/admin tab
// ==========================================

const API_BASE_URL = '';  // Same server — relative URL

// Current State
let currentTab = 'clinic'; // Always clinic
let currentLang = 'en';
let tempToken = '';
let accessToken = '';
let lastLoginData = null;

// Translation Dictionary
const translations = {
  ar: {
    badge_text: "نظام تشغيل العيادة الذكي",
    left_title: "بنية تحتية طبية رقمية متكاملة",
    left_desc: "تحكم كامل بالعيادة، إدارة الكاليندر الفوري، الفرز الطبي التلقائي بالذكاء الاصطناعي، ومزامنة البيانات في وضع عدم الاتصال.",
    brand_sub: "بوابة العيادة الذكية",
    tab_clinic: "بوابة العيادة",
    login_title_clinic: "تسجيل دخول الطاقم الطبي",
    login_desc_clinic: "أدخل البريد الإلكتروني وكلمة المرور المسجلة لعيادتك",
    label_email: "البريد الإلكتروني",
    label_password: "كلمة المرور",
    btn_login: "تسجيل الدخول",
    btn_verify: "تأكيد الرمز والدخول",
    btn_back: "العودة لشاشة الدخول",
    btn_logout: "تسجيل الخروج",
    otp_title: "رمز التحقق الثنائي (2FA)",
    otp_desc: "تم إرسال كود التحقق إلى بريدك الإلكتروني.",
    otp_console_notice: "تم طباعة الكود (123456) في Console.",
    success_title: "تم تسجيل الدخول بنجاح!",
    welcome_clinic: "مرحباً بك د./أ. {name} في عيادتك {clinic}!",
    err_network: "فشل الاتصال بالخادم. تأكد من تشغيل السيرفر.",
    lang_toggle: "English"
  },
  en: {
    badge_text: "Smart Clinic OS",
    left_title: "Integrated Digital Medical Infrastructure",
    left_desc: "Complete clinic control, instant calendar scheduling, automatic AI triage, and offline data synchronization.",
    brand_sub: "Smart Clinic Portal",
    tab_clinic: "Clinic Portal",
    login_title_clinic: "Medical Staff Login",
    login_desc_clinic: "Enter your registered email and password for your clinic",
    label_email: "Email Address",
    label_password: "Password",
    btn_login: "Sign In",
    btn_verify: "Confirm Code & Verify",
    btn_back: "Back to Login",
    btn_logout: "Log Out",
    otp_title: "Two-Factor Auth (2FA)",
    otp_desc: "A verification code has been sent to your email.",
    otp_console_notice: "The verification code (123456) is printed in the console.",
    success_title: "Successfully Logged In!",
    welcome_clinic: "Welcome Dr./Mr. {name} to your clinic: {clinic}!",
    err_network: "Failed to connect to server. Make sure the server is running.",
    lang_toggle: "العربية"
  }
};

// --- DOM Elements ---
const langToggleBtn = document.getElementById('lang-toggle-btn');
const langToggleText = langToggleBtn.querySelector('.lang-text');
const authTabs = document.getElementById('auth-tabs');
const tabButtons = authTabs.querySelectorAll('.tab-btn');
const alertPanel = document.getElementById('alert-panel');
const alertMsg = document.getElementById('alert-msg');

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

  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    hideLoading('login-submit-btn', 'btn_login');

    if (data.success) {
      accessToken = data.data.access_token;
      showSuccessState(data.data);
    } else {
      showAlert(data.error.message);
    }
  } catch (error) {
    hideLoading('login-submit-btn', 'btn_login');
    showAlert(translations[currentLang].err_network);
    console.error('Network Error:', error);
  }
});

// OTP form (kept for DOM compatibility, not used in clinic)
otpInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => { if (e.target.value.length === 1 && index < otpInputs.length - 1) otpInputs[index + 1].focus(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) otpInputs[index - 1].focus(); });
});

otpForm.addEventListener('submit', (e) => { e.preventDefault(); });
document.getElementById('otp-back-btn').addEventListener('click', () => { hideAlert(); switchStage('login'); });

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
  accessToken = '';
  lastLoginData = null;
  emailInput.value = '';
  passwordInput.value = '';
  hideAlert();
  switchStage('login');
});

// --- Helper Functions ---
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
function hideAlert() { /* Toast auto-fades */ }

function updateStageText() {
  stageTitle.innerText = translations[currentLang].login_title_clinic;
  stageDesc.innerText = translations[currentLang].login_desc_clinic;
}

function applyTranslation() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => { const key = el.dataset.i18n; if (translations[currentLang][key]) el.innerText = translations[currentLang][key]; });
  langToggleText.innerText = translations[currentLang].lang_toggle;
  if (lastLoginData) {
    const welcomeText = translations[currentLang].welcome_clinic.replace('{name}', lastLoginData.user.full_name).replace('{clinic}', lastLoginData.tenant.name);
    userWelcomeMsg.innerText = welcomeText;
  }
}

function showLoading(btnId) { const btn = document.getElementById(btnId); btn.disabled = true; btn.querySelector('.btn-text').classList.add('hide'); btn.querySelector('.spinner').classList.remove('hide'); }
function hideLoading(btnId, i18nKey) { const btn = document.getElementById(btnId); btn.disabled = false; btn.querySelector('.btn-text').classList.remove('hide'); btn.querySelector('.spinner').classList.add('hide'); btn.querySelector('.btn-text').innerText = translations[currentLang][i18nKey]; }

function showSuccessState(data) {
  lastLoginData = data;
  switchStage('success');
  const welcomeText = translations[currentLang].welcome_clinic.replace('{name}', data.user.full_name).replace('{clinic}', data.tenant.name);
  const succClinicCard = document.getElementById('success-clinic-card');
  if (succClinicCard) {
    succClinicCard.classList.remove('hide');
    document.getElementById('succ-clinic-url').innerText = `${data.tenant.slug}.SCS-clinic.com`;
    const planBadge = document.getElementById('succ-clinic-plan');
    planBadge.className = `plan-badge plan-${data.tenant.subscription_plan.toLowerCase()}`;
    planBadge.innerText = data.tenant.subscription_plan.toUpperCase();
  }
  userWelcomeMsg.innerText = welcomeText;
  tokenDisplayBox.innerText = data.access_token;
}

// Copy Token
document.addEventListener('DOMContentLoaded', () => {
  const btnCopyToken = document.getElementById('btn-copy-token');
  if (btnCopyToken) {
    btnCopyToken.addEventListener('click', () => {
      navigator.clipboard.writeText(tokenDisplayBox.innerText).then(() => {
        showToast(currentLang === 'ar' ? 'تم نسخ رمز الجلسة JWT بنجاح!' : 'JWT Token copied successfully!', 'success');
        const icon = btnCopyToken.querySelector('i');
        icon.className = 'fa-solid fa-check text-success';
        setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 2000);
      });
    });
  }
});

// Initialize
applyTranslation();
updateStageText();
