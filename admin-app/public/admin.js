// ==========================================
// Smart Clinic OS (SCS) Platform Ops Controller
// Manages dashboard KPIs, Onboarding, and Subscriptions
// ==========================================

const API_BASE_URL = '';

let token = sessionStorage.getItem('ops_token');
let currentLang = 'en';
let allTenants = [];

// --- Navigation Tab Panel Controls (Declared at Top for Scope safety) ---
const tabBtnHome = document.getElementById('tab-btn-home');
const tabBtnClinics = document.getElementById('tab-btn-clinics');
const tabBtnPlans = document.getElementById('tab-btn-plans');

const panelHome = document.getElementById('ops-panel-home');
const panelClinics = document.getElementById('ops-panel-clinics');
const panelPlans = document.getElementById('ops-panel-plans');

const requestedTab = new URLSearchParams(window.location.search).get('tab');
const initialOpsTab = requestedTab === 'clinics' || requestedTab === 'plans' ? requestedTab : 'home';

// i18n Translations Dictionary
const translations = {
  ar: {
    ops_title: "إدارة عيادات ومستأجري المنصة",
    ops_subtitle: "لوحة عمليات الشركة المصنعة لإضافة العيادات وتتبع خطط الاشتراكات والتحكم بصلاحية الوصول.",
    btn_add_clinic: "إضافة عيادة جديدة",
    kpi_total: "إجمالي العيادات",
    kpi_active: "العيادات النشطة",
    kpi_suspended: "العيادات المعلقة",
    kpi_expiring: "اشتراكات تنتهي قريباً",
    kpi_mrr: "الدخل الشهري المتكرر (MRR)",
    report_financial_title: "تقارير الإيرادات والدخل المتكرر",
    report_distribution_title: "توزيع خطط الاشتراك للعيادات",
    table_title: "قائمة المستأجرين والعيادات",
    th_name: "اسم العيادة / المالك",
    th_slug: "رابط العيادة (Slug)",
    th_specialty: "التخصص",
    th_plan: "باقة الاشتراك",
    th_contact: "بيانات الاتصال",
    th_expiry: "تاريخ الانتهاء",
    th_status: "الحالة",
    th_actions: "إجراءات إدارية",
    loading_text: "جاري تحميل البيانات...",
    btn_renew: "تجديد الاشتراك",
    btn_suspend: "تعليق الحساب",
    btn_reactivate: "إعادة تنشيط",
    status_active: "نشط",
    status_suspended: "معلق",
    status_expired: "منتهي",
    modal_title: "إضافة عيادة جديدة للمنصة",
    label_clinic_name: "اسم العيادة",
    label_clinic_slug: "رابط العيادة (Subdomain / Slug)",
    label_specialty: "التخصص الطبي",
    label_plan: "خطة الاشتراك",
    label_owner_email: "البريد الإلكتروني للطبيب المالك",
    label_owner_phone: "رقم الهاتف للطبيب",
    modal_notice_text: "بمجرد إنشاء العيادة، سيقوم النظام تلقائياً بإنشاء حساب المالك وتوليد رابط التفعيل. كلمة المرور الافتراضية هي SecurePassword123!",
    btn_cancel: "إلغاء",
    btn_create: "إنشاء العيادة وتفعيلها",
    btn_copy: "نسخ الرابط",
    btn_done: "موافق",
    success_modal_title: "تم إنشاء العيادة بنجاح!",
    success_modal_desc: "تم تأسيس العيادة وإنشاء مستندات الطبيب المالك في قاعدة البيانات بنجاح. يرجى نسخ رابط تفعيل الحساب وإرساله للطبيب للبدء:",
    opt_dental: "Dental (طب أسنان)",
    opt_derma: "Dermatology (جلدية وتجميل)",
    opt_pediatric: "Pediatric (أطفال)",
    opt_general: "General Practice (ممارس عام)",
    plan_basic: "Basic ($50/m)",
    plan_pro: "Pro ($100/m)",
    plan_enterprise: "Enterprise ($250/m)",
    lang_toggle: "English",
    renew_modal_title: "تجديد اشتراك العيادة",
    renew_clinic_label: "العيادة:",
    renew_expiry_label: "تاريخ الانتهاء الحالي:",
    label_renew_duration: "مدة التجديد المطلوبة",
    renew_opt_1m: "شهر واحد",
    renew_opt_3m: "3 أشهر",
    renew_opt_6m: "6 أشهر",
    renew_opt_12m: "سنة واحدة (12 شهر)",
    renew_opt_24m: "سنتين (24 شهر)",
    btn_confirm_renew: "تأكيد التجديد والتفعيل",
    btn_edit: "تعديل البيانات",
    btn_delete: "حذف العيادة",
    edit_modal_title: "تعديل بيانات العيادة",
    btn_save_changes: "حفظ التعديلات",
    err_network: "حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً",
    err_unknown: "حدث خطأ غير معروف",
    btn_view_audit: "سجل العمليات",
    features_override_title: "تخصيص ميزات وصلاحيات العيادة (Feature Flags)",
    feature_multi_doctor: "أطباء متعددون",
    feature_multi_doctor_desc: "السماح بإضافة أطباء فرعيين وجدول عمل لكل طبيب.",
    feature_insurance: "التأمين الطبي",
    feature_insurance_desc: "تفعيل تبويب وخصائص شركات وموافقات التأمين الطبي.",
    feature_refunds: "الاسترداد التلقائي",
    feature_refunds_desc: "السماح للمريض بإلغاء الحجز واسترداد الرصيد تلقائياً.",
    history_modal_title: "سجل تغييرات الاشتراكات",
    audit_modal_title: "سجل العمليات الأمني للمنصة",
    audit_th_operator: "المشغل",
    audit_th_action: "العملية",
    audit_th_target: "الهدف",
    audit_th_details: "التفاصيل",
    audit_th_ip: "عنوان IP",
    audit_th_date: "التاريخ",
    btn_reset_pwd: "إعادة تعيين كلمة المرور",
    btn_sub_history: "سجل الاشتراكات",
    filter_all_statuses: "كل الحالات",
    filter_active: "نشط",
    filter_suspended: "معلق",
    table_head_clinic: "اسم العيادة / المالك",
    table_head_slug: "رابط العيادة (Slug)",
    table_head_specialty: "التخصص",
    table_head_plan: "باقة الاشتراك",
    table_head_contact: "بيانات الاتصال",
    table_head_expiry: "تاريخ الانتهاء",
    table_head_status: "الحالة",
    table_head_actions: "إجراءات إدارية",
    no_records: "لا توجد سجلات.",
    no_audit_logs: "لا توجد عمليات أمان مسجلة.",
    no_subscription_history: "لا يوجد سجل اشتراكات لهذه العيادة.",
    bookings: "المواعيد",
    old_plan: "الخطة السابقة",
    new_plan: "الخطة الجديدة",
    password_reset_success: "تمت إعادة التعيين بنجاح. تم طباعة الرابط في Console الخادم.",
    password_reset_confirm: "هل أنت متأكد من إعادة تعيين كلمة المرور لهذا الطبيب؟ سيتم توليد رابط جديد.",
    reset_link: "رابط إعادة التعيين",
    click_to_open: "اضغط لفتح إدارة التفاصيل",
    confirm_action: "تأكيد",
    cancel_action: "إلغاء",
    back_to_home: "العودة للرئيسية",
    back_to_list: "العودة لقائمة العيادات",
    dashboard_home: "الرئيسية",
    dashboard_clinics: "إدارة العيادات",
    dashboard_plans: "إدارة الباقات",
    badge_ops: "Ops Console",
    dashboard_title: "إحصائيات وأداء المنصة",
    dashboard_subtitle: "لوحة مشغل النظام لمتابعة نمو العيادات، الدخل المتكرر، وإجراءات الأمان السريعة.",
    filter_all_plans: "كل الباقات",
    table_title: "قائمة المستأجرين والعيادات",
    search_placeholder: "ابحث بالاسم أو الرابط...",
    loading_text: "جاري تحميل البيانات...",
    kpi_total: "إجمالي العيادات",
    kpi_active: "العيادات النشطة",
    kpi_suspended: "العيادات المعلقة",
    kpi_expiring: "اشتراكات تنتهي قريباً"
  },
  en: {
    ops_title: "Platform Tenants & Clinics Management",
    ops_subtitle: "Manufacturer operations console for clinic onboarding, subscription tracking, and access control.",
    btn_add_clinic: "Onboard New Clinic",
    kpi_total: "Total Clinics",
    kpi_active: "Active Clinics",
    kpi_suspended: "Suspended Clinics",
    kpi_expiring: "Expiring Soon",
    kpi_mrr: "Monthly Recurring Revenue (MRR)",
    report_financial_title: "Revenue & MRR Reports",
    report_distribution_title: "Subscription Plan Distribution",
    table_title: "Clinics & Tenants Registry",
    th_name: "Clinic / Owner",
    th_slug: "Clinic URL (Slug)",
    th_specialty: "Specialty",
    th_plan: "Subscription Plan",
    th_contact: "Contact Details",
    th_expiry: "Expiry Date",
    th_status: "Status",
    th_actions: "Administrative Actions",
    loading_text: "Loading data...",
    btn_renew: "Renew",
    btn_suspend: "Suspend",
    btn_reactivate: "Reactivate",
    status_active: "Active",
    status_suspended: "Suspended",
    status_expired: "Expired",
    modal_title: "Onboard New Clinic to Platform",
    label_clinic_name: "Clinic Name",
    label_clinic_slug: "Clinic URL (Subdomain / Slug)",
    label_specialty: "Medical Specialty",
    label_plan: "Subscription Plan",
    label_owner_email: "Owner Doctor Email",
    label_owner_phone: "Doctor Phone Number",
    modal_notice_text: "Onboarding creates the clinic tenant and the owner doctor account. Default password: SecurePassword123!",
    btn_cancel: "Cancel",
    btn_create: "Create & Onboard Clinic",
    btn_copy: "Copy Link",
    btn_done: "Done",
    success_modal_title: "Clinic Onboarded Successfully!",
    success_modal_desc: "Clinic and owner credentials have been established. Please copy and send the activation link to the doctor:",
    opt_dental: "Dental",
    opt_derma: "Dermatology",
    opt_pediatric: "Pediatric",
    opt_general: "General Practice",
    plan_basic: "Basic ($50/m)",
    plan_pro: "Pro ($100/m)",
    plan_enterprise: "Enterprise ($250/m)",
    lang_toggle: "العربية",
    renew_modal_title: "Renew Clinic Subscription",
    renew_clinic_label: "Clinic:",
    renew_expiry_label: "Current Expiry:",
    label_renew_duration: "Select Renewal Duration",
    renew_opt_1m: "1 Month",
    renew_opt_3m: "3 Months",
    renew_opt_6m: "6 Months",
    renew_opt_12m: "1 Year (12 Months)",
    renew_opt_24m: "2 Years (24 Months)",
    btn_confirm_renew: "Confirm Renewal",
    btn_edit: "Edit Details",
    btn_delete: "Delete Clinic",
    edit_modal_title: "Edit Clinic Details",
    btn_save_changes: "Save Changes",
    err_network: "Network error connecting to the server. Please try again later.",
    err_unknown: "An unknown error occurred",
    btn_view_audit: "Audit Logs",
    features_override_title: "Clinic Feature Flags & Permissions Override",
    feature_multi_doctor: "Multi-Doctor",
    feature_multi_doctor_desc: "Allow adding sub-doctors and separate schedule per doctor.",
    feature_insurance: "Insurance",
    feature_insurance_desc: "Enable insurance companies & approvals management.",
    feature_refunds: "Auto-Refunds",
    feature_refunds_desc: "Allow patients to cancel appointments and auto-refund.",
    history_modal_title: "Subscription History Timeline",
    audit_modal_title: "Platform Security Audit Logs",
    audit_th_operator: "Operator",
    audit_th_action: "Action",
    audit_th_target: "Target",
    audit_th_details: "Details",
    audit_th_ip: "IP Address",
    audit_th_date: "Date",
    btn_reset_pwd: "Reset Password",
    btn_sub_history: "Subscription History",
    filter_all_statuses: "All Statuses",
    filter_active: "Active",
    filter_suspended: "Suspended",
    table_head_clinic: "Clinic / Owner",
    table_head_slug: "Clinic URL (Slug)",
    table_head_specialty: "Specialty",
    table_head_plan: "Subscription Plan",
    table_head_contact: "Contact Details",
    table_head_expiry: "Expiry Date",
    table_head_status: "Status",
    table_head_actions: "Administrative Actions",
    no_records: "No records found.",
    no_audit_logs: "No security operations recorded.",
    no_subscription_history: "No subscription history found.",
    bookings: "Bookings",
    old_plan: "Old Plan",
    new_plan: "New Plan",
    password_reset_success: "Password reset link generated. Output in server console.",
    password_reset_confirm: "Are you sure you want to reset password for this doctor? A new link will be generated.",
    reset_link: "Reset Link",
    click_to_open: "Click to open details manager",
    confirm_action: "Confirm",
    cancel_action: "Cancel",
    back_to_home: "Back to Home",
    back_to_list: "Back to Clinics List",
    dashboard_home: "Dashboard",
    dashboard_clinics: "Manage Clinics",
    dashboard_plans: "Manage Plans",
    badge_ops: "Ops Console",
    dashboard_title: "Platform Analytics & Performance",
    dashboard_subtitle: "Operations console to monitor clinic growth, recurring revenue, and quick security actions.",
    filter_all_plans: "All Plans",
    table_title: "Clinics & Tenants Registry",
    search_placeholder: "Search by name or URL...",
    loading_text: "Loading data...",
    kpi_total: "Total Clinics",
    kpi_active: "Active Clinics",
    kpi_suspended: "Suspended Clinics",
    kpi_expiring: "Expiring Soon"
  }
};

// --- Check Authorization on Load ---
if (!token) {
  window.location.href = 'index.html';
}

// Decode token payload
let operatorUser = { full_name: 'مشغل النظام', role: 'Super Admin' };
if (token && token.includes('.')) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payloadObj = JSON.parse(jsonPayload);
    operatorUser.full_name = payloadObj.full_name || payloadObj.email;
    operatorUser.role = payloadObj.role === 'super_admin' ? 'Super Admin' : 'Admin';
  } catch (e) {
    console.warn('Failed to parse token payload:', e);
  }
}

// --- DOM Elements ---
const langToggleBtn = document.getElementById('lang-toggle-btn');
const langToggleText = langToggleBtn.querySelector('.lang-text');
const operatorNameLabel = document.getElementById('operator-name');
const operatorRoleLabel = document.getElementById('operator-role');
const logoutBtn = document.getElementById('logout-btn');

const kpiTotalClinics = document.getElementById('kpi-total-clinics');
const kpiActiveClinics = document.getElementById('kpi-active-clinics');
const kpiSuspendedClinics = document.getElementById('kpi-suspended-clinics');
const kpiExpiringSoon = document.getElementById('kpi-expiring-soon');
const tableBody = document.getElementById('clinics-table-body');
const alertPanel = document.getElementById('alert-panel');
const alertMsg = document.getElementById('alert-msg');

// Modal Elements
const addClinicBtn = document.getElementById('add-clinic-btn');
const addClinicModal = document.getElementById('add-clinic-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const addClinicForm = document.getElementById('add-clinic-form');

const successModal = document.getElementById('success-modal');
const successCloseBtn = document.getElementById('success-close-btn');
const successDoneBtn = document.getElementById('success-done-btn');
const activationLinkInput = document.getElementById('activation-link-input');
const copyLinkBtn = document.getElementById('copy-link-btn');

// --- Initialization ---
operatorNameLabel.innerText = operatorUser.full_name;
operatorRoleLabel.innerText = operatorUser.role;

// --- Event Listeners ---

// Table filter controls
const tableSearchInput = document.getElementById('table-search-input');
const filterPlanSelect = document.getElementById('filter-plan');
const filterStatusSelect = document.getElementById('filter-status');

const applyTableFilters = () => {
  const query = tableSearchInput.value.toLowerCase().trim();
  const plan = filterPlanSelect.value;
  const status = filterStatusSelect.value;

  const filtered = allTenants.filter(t => {
    const doctorName = t.doctor && t.doctor.name ? t.doctor.name.toLowerCase() : (t.owner_name ? t.owner_name.toLowerCase() : '');
    const matchesSearch = !query || 
      (t.name || '').toLowerCase().includes(query) ||
      (t.slug || '').toLowerCase().includes(query) ||
      (t.specialty || '').toLowerCase().includes(query) ||
      doctorName.includes(query);

    const matchesPlan = plan === 'all' || (t.subscription_plan || '').toLowerCase() === plan;
    
    const now = new Date();
    const expiry = new Date(t.expires_at);
    const isExpired = expiry <= now;

    let matchesStatus = false;
    if (status === 'all') {
      matchesStatus = true;
    } else if (status === 'active') {
      matchesStatus = t.status === 'active' && !isExpired;
    } else if (status === 'suspended') {
      matchesStatus = t.status === 'suspended';
    } else if (status === 'expired') {
      matchesStatus = t.status === 'active' && isExpired;
    }

    return matchesSearch && matchesPlan && matchesStatus;
  });

  renderTable(filtered);
};

if (tableSearchInput) tableSearchInput.addEventListener('input', applyTableFilters);
if (filterPlanSelect) filterPlanSelect.addEventListener('change', applyTableFilters);
if (filterStatusSelect) filterStatusSelect.addEventListener('change', applyTableFilters);

// 1. Language Toggle
if (langToggleBtn) {
  langToggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    
    applyTranslation();
    loadDashboardData();
  });
}

// 2. Logout Action
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('ops_token');
    window.location.href = 'index.html';
  });
}

// 3. Modal Actions
if (addClinicBtn) {
  addClinicBtn.addEventListener('click', () => {
    hideAlert();
    addClinicForm.reset();
    
    // Set default dates: Start date = today, End date = today + 1 year
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    
    document.getElementById('subscription-start-date').value = today.toISOString().split('T')[0];
    document.getElementById('subscription-end-date').value = nextYear.toISOString().split('T')[0];
    
    addClinicModal.classList.remove('hide');
  });
}

const closeModal = () => {
  if (addClinicModal) addClinicModal.classList.add('hide');
};
if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

// 4. Form Submit Onboarding
if (addClinicForm) {
  addClinicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    showLoading('onboard-submit-btn');

    const payload = {
      name: document.getElementById('clinic-name').value,
      slug: document.getElementById('clinic-slug').value,
      specialty: document.getElementById('clinic-specialty').value,
      subscription_plan: document.getElementById('clinic-plan').value,
      subscription_start_date: document.getElementById('subscription-start-date').value,
      subscription_expires_at: document.getElementById('subscription-end-date').value,
      email: document.getElementById('owner-email').value,
      phone: document.getElementById('owner-phone').value
    };

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/tenants`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      hideLoading('onboard-submit-btn', 'btn_create');

      if (data.success) {
        closeModal();
        
        // Open Success Modal with Link
        activationLinkInput.value = data.data.activation_link;
        successModal.classList.remove('hide');
        
        loadDashboardData(); // Refresh list
      } else {
        showAlert(data.error.message);
        closeModal();
      }
    } catch (error) {
      hideLoading('onboard-submit-btn', 'btn_create');
      closeModal();
      showAlert(translations[currentLang].err_network);
    }
  });
}

// Success Modal buttons
const closeSuccessModal = () => {
  if (successModal) successModal.classList.add('hide');
};
if (successCloseBtn) successCloseBtn.addEventListener('click', closeSuccessModal);
if (successDoneBtn) successDoneBtn.addEventListener('click', closeSuccessModal);

// Copy Link
if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', () => {
    activationLinkInput.select();
    activationLinkInput.setSelectionRange(0, 99999); // Mobile
    navigator.clipboard.writeText(activationLinkInput.value);
    
    // Quick button text toggle
    const originalText = copyLinkBtn.innerText;
    copyLinkBtn.innerText = currentLang === 'ar' ? 'تم النسخ! ✓' : 'Copied! ✓';
    setTimeout(() => {
      copyLinkBtn.innerText = originalText;
    }, 2000);
  });
}

// --- Fetch Dashboard Data ---
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/tenants`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      // Session expired or invalid
      sessionStorage.removeItem('ops_token');
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    if (data.success) {
      // Update KPIs if they exist on the page
      if (kpiTotalClinics) kpiTotalClinics.innerText = data.data.stats.total_clinics;
      if (kpiActiveClinics) kpiActiveClinics.innerText = data.data.stats.active_clinics;
      if (kpiSuspendedClinics) kpiSuspendedClinics.innerText = data.data.stats.suspended_clinics || 0;
      if (kpiExpiringSoon) kpiExpiringSoon.innerText = data.data.stats.pending_expiry;
      
      // Update Financial Reports if they exist on the page
      const mrrEl = document.getElementById('report-mrr-value');
      if (mrrEl) mrrEl.innerText = `$${data.data.stats.estimated_mrr}`;
      
      const plans = data.data.stats.plans || { basic: 0, pro: 0, enterprise: 0 };
      
      const basicDetailsEl = document.getElementById('rev-basic-details');
      if (basicDetailsEl) basicDetailsEl.innerText = `${plans.basic} clinics ($${plans.basic * 50}/m)`;
      const proDetailsEl = document.getElementById('rev-pro-details');
      if (proDetailsEl) proDetailsEl.innerText = `${plans.pro} clinics ($${plans.pro * 100}/m)`;
      const entDetailsEl = document.getElementById('rev-enterprise-details');
      if (entDetailsEl) entDetailsEl.innerText = `${plans.enterprise} clinics ($${plans.enterprise * 250}/m)`;
      
      // Update Plan Distribution Charts if they exist on the page
      const activeTotal = plans.basic + plans.pro + plans.enterprise || 1; // avoid division by zero
      const basicPerc = Math.round((plans.basic / activeTotal) * 100);
      const proPerc = Math.round((plans.pro / activeTotal) * 100);
      const enterprisePerc = Math.round((plans.enterprise / activeTotal) * 100);
      
      const distBasicPercEl = document.getElementById('dist-basic-perc');
      if (distBasicPercEl) distBasicPercEl.innerText = `${basicPerc}%`;
      const distBasicBarEl = document.getElementById('dist-basic-bar');
      if (distBasicBarEl) distBasicBarEl.style.width = `${basicPerc}%`;
      
      const distProPercEl = document.getElementById('dist-pro-perc');
      if (distProPercEl) distProPercEl.innerText = `${proPerc}%`;
      const distProBarEl = document.getElementById('dist-pro-bar');
      if (distProBarEl) distProBarEl.style.width = `${proPerc}%`;
      
      const distEntPercEl = document.getElementById('dist-enterprise-perc');
      if (distEntPercEl) distEntPercEl.innerText = `${enterprisePerc}%`;
      const distEntBarEl = document.getElementById('dist-enterprise-bar');
      if (distEntBarEl) distEntBarEl.style.width = `${enterprisePerc}%`;
      
      // Save globally and filter table
      allTenants = data.data.tenants;
      if (panelClinics) {
        applyTableFilters();
      }
    } else {
      showAlert(data.error.message);
    }
  } catch (error) {
    console.error('loadDashboardData Error:', error);
    showAlert(translations[currentLang].err_network);
  }
}

// --- Render Table ---
function renderTable(tenants) {
  if (tenants.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center">لا توجد عيادات مسجلة حالياً.</td></tr>`;
    return;
  }

  tableBody.innerHTML = '';
  
  tenants.forEach(tenant => {
    const row = document.createElement('tr');
    
    // Status formatting
    const now = new Date();
    const expiry = new Date(tenant.expires_at);
    const isExpired = expiry <= now;
    
    let statusText = '';
    let statusClass = '';
    let statusIcon = '';
    
    if (tenant.status === 'suspended') {
      statusText = translations[currentLang].status_suspended;
      statusClass = 'status-suspended-badge';
      statusIcon = `<i class="fa-solid fa-circle-pause"></i> `;
    } else if (isExpired) {
      statusText = translations[currentLang].status_expired;
      statusClass = 'status-suspended-badge';
      statusIcon = `<i class="fa-solid fa-circle-exclamation text-danger"></i> `;
    } else {
      statusText = translations[currentLang].status_active;
      statusClass = 'status-active-badge';
      statusIcon = `<i class="fa-solid fa-circle-check"></i> `;
    }

    // Actions rendering
    const manageButton = `<button class="action-btn btn-primary-sm" style="background: rgba(37,99,235,0.1); color: #2563eb; border-color: rgba(37,99,235,0.2); padding: 5px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; font-family: 'Cairo', sans-serif;" title="${currentLang === 'ar' ? 'إدارة تفاصيل العيادة' : 'Manage Clinic Details'}" onclick="openClinicDetails('${tenant.id}')"><i class="fa-solid fa-gears"></i> <span>${currentLang === 'ar' ? 'إدارة' : 'Manage'}</span></button>`;

    // Format Expiry Date
    const expiryDate = new Date(tenant.expires_at).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US');
    
    // Expiry warnings styling
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    let expiryClass = '';
    if (expiry <= now) {
      expiryClass = 'expiry-warning expired';
    } else if (expiry <= thirtyDaysFromNow) {
      expiryClass = 'expiry-warning soon';
    }
    
    const expiryCellContent = expiryClass 
      ? `<span class="${expiryClass}">${expiryDate}</span>`
      : expiryDate;

    // Plan styling
    const planClass = `plan-badge plan-${tenant.subscription_plan.toLowerCase()}`;

    // Feature Flags Badges
    let featuresHTML = '<div class="table-feature-flags" style="margin-top: 6px; display: flex; gap: 4px; justify-content: flex-start;">';
    if (tenant.allow_multi_doctor) {
      featuresHTML += `<span class="flag-badge-pill" style="font-size: 9px; padding: 1px 4px; background: rgba(124,58,237,0.1); color: #7c3aed; border-radius: 4px; font-weight: bold; border: 1px solid rgba(124,58,237,0.2);" title="Multi-Doctor">MD</span>`;
    }
    if (tenant.allow_insurance) {
      featuresHTML += `<span class="flag-badge-pill" style="font-size: 9px; padding: 1px 4px; background: rgba(37,99,235,0.1); color: #2563eb; border-radius: 4px; font-weight: bold; border: 1px solid rgba(37,99,235,0.2);" title="Insurance">IN</span>`;
    }
    if (tenant.allow_refunds) {
      featuresHTML += `<span class="flag-badge-pill" style="font-size: 9px; padding: 1px 4px; background: rgba(16,185,129,0.1); color: #10b981; border-radius: 4px; font-weight: bold; border: 1px solid rgba(16,185,129,0.2);" title="Auto-Refunds">RF</span>`;
    }
    featuresHTML += '</div>';

    const lastLogin = tenant.doctor && tenant.doctor.last_login_at
      ? new Date(tenant.doctor.last_login_at).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US')
      : '—';

    const stats = tenant.usage_stats || { total_patients: 0, total_appointments: 0, whatsapp_connection: 'disconnected', storage_used_mb: 0 };
    const waIcon = stats.whatsapp_connection === 'connected'
      ? `<span class="flag-badge-pill" style="font-size: 8px; padding: 1px 3px; background: rgba(16,185,129,0.1); color: #10b981; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2);" title="WhatsApp Active"><i class="fa-brands fa-whatsapp"></i> Live</span>`
      : `<span class="flag-badge-pill" style="font-size: 8px; padding: 1px 3px; background: rgba(239,68,68,0.1); color: #ef4444; border-radius: 4px; border: 1px solid rgba(239,68,68,0.2);" title="WhatsApp Inactive"><i class="fa-brands fa-whatsapp"></i> Off</span>`;

    row.innerHTML = `
      <td>
        <div class="clinic-cell-name" style="cursor: pointer; text-decoration: underline; color: #3b82f6; font-weight: bold;" onclick="openClinicDetails('${tenant.id}')" title="${currentLang === 'ar' ? 'اضغط لفتح إدارة التفاصيل' : 'Click to open details manager'}">${tenant.name}</div>
        <div class="clinic-cell-desc" style="font-weight: 600; color: #fff; margin-top: 4px;">
          <i class="fa-solid fa-user-doctor" style="margin-left: 4px; font-size: 11px; color: #7c3aed;"></i>
          ${tenant.doctor ? tenant.doctor.name : (tenant.owner_name || '—')}
        </div>
      </td>
      <td>
        <code>${tenant.slug}</code>
      </td>
      <td><span class="specialty-label">${tenant.specialty || 'General'}</span></td>
      <td>
        <span class="${planClass}">${tenant.subscription_plan.toUpperCase()}</span>
      </td>
      <td>
        <div class="clinic-contact-email">${tenant.owner_email || '—'}</div>
        <div class="clinic-contact-phone">${tenant.owner_phone || '—'}</div>
      </td>
      <td>${expiryCellContent}</td>
      <td><span class="${statusClass}">${statusIcon}${statusText}</span></td>
      <td>
        <div class="table-actions">
          ${manageButton}
        </div>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}

// --- Administrative Operations ---

// --- Translation helpers ---
function applyTranslation() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.dataset.i18n;
    if (translations[currentLang][key]) {
      if (el.tagName === 'OPTION') {
        el.innerText = translations[currentLang][key];
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translations[currentLang][key];
      } else {
        el.innerText = translations[currentLang][key];
      }
    }
  });

  // Handle data-i18n-placeholder
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (translations[currentLang][key]) {
      el.placeholder = translations[currentLang][key];
    }
  });

  // Update dropdown translations placeholder
  const specialtySelect = document.getElementById('clinic-specialty');
  if (specialtySelect) {
    specialtySelect.options[0].text = translations[currentLang].opt_dental;
    specialtySelect.options[1].text = translations[currentLang].opt_derma;
    specialtySelect.options[2].text = translations[currentLang].opt_pediatric;
    specialtySelect.options[3].text = translations[currentLang].opt_general;
  }

  const planSelect = document.getElementById('clinic-plan');
  if (planSelect) {
    planSelect.options[0].text = translations[currentLang].plan_basic;
    planSelect.options[1].text = translations[currentLang].plan_pro;
    planSelect.options[2].text = translations[currentLang].plan_enterprise;
  }



  // Update filter options
  const filterStatusSelect = document.getElementById('filter-status');
  if (filterStatusSelect) {
    filterStatusSelect.options[0].text = translations[currentLang].filter_all_statuses;
    filterStatusSelect.options[1].text = translations[currentLang].filter_active;
    filterStatusSelect.options[2].text = translations[currentLang].filter_suspended;
  }

  langToggleText.innerText = translations[currentLang].lang_toggle;
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-solid fa-circle-info';
  if (type === 'success') iconClass = 'fa-solid fa-circle-check';
  if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
  
  toast.innerHTML = `
    <div class="toast-icon"><i class="${iconClass}"></i></div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" type="button">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Trigger transition
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Close button handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
  
  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Loading buttons styling helpers
function showLoading(btnId) {
  const btn = document.getElementById(btnId);
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  
  btn.disabled = true;
  text.classList.add('hide');
  spinner.classList.remove('hide');
}

function hideLoading(btnId, i18nKey) {
  const btn = document.getElementById(btnId);
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  
  btn.disabled = false;
  text.classList.remove('hide');
  spinner.classList.add('hide');
  if (i18nKey && translations[currentLang] && translations[currentLang][i18nKey]) {
    text.innerText = translations[currentLang][i18nKey];
  }
}

function showAlert(message) {
  showToast(message, 'error');
}

function hideAlert() {
  // Toast notifications auto-fade, no-op for backward compatibility
}



// --- Audit Logs Modal ---
const auditLogsModal = document.getElementById('audit-logs-modal');
const auditCloseBtn = document.getElementById('audit-close-btn');
const auditDoneBtn = document.getElementById('audit-done-btn');
const auditLogsTableBody = document.getElementById('audit-logs-table-body');
const viewAuditLogsBtn = document.getElementById('view-audit-logs-btn');

if (viewAuditLogsBtn) {
  viewAuditLogsBtn.addEventListener('click', async () => {
    hideAlert();
    if (auditLogsTableBody) auditLogsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">جاري تحميل سجل العمليات...</td></tr>';
    if (auditLogsModal) auditLogsModal.classList.remove('hide');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/audit-logs`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        if (!auditLogsTableBody) return;
        if (data.data.length === 0) {
          auditLogsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">لا توجد عمليات مسجلة حالياً.</td></tr>';
          return;
        }

        auditLogsTableBody.innerHTML = '';
        data.data.forEach(log => {
          const row = document.createElement('tr');
          
          const dateStr = new Date(log.created_at).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-US');
          
          // Translate action labels
          let actionLabel = log.action;
          let actionClass = 'plan-badge plan-basic';
          if (log.action === 'tenant.create') { actionClass = 'plan-badge plan-pro'; actionLabel = currentLang === 'ar' ? 'إنشاء عيادة' : 'Onboard Clinic'; }
          else if (log.action === 'tenant.deactivate') { actionClass = 'plan-badge plan-basic'; actionLabel = currentLang === 'ar' ? 'تعليق حساب' : 'Suspend'; }
          else if (log.action === 'tenant.activate') { actionClass = 'plan-badge plan-pro'; actionLabel = currentLang === 'ar' ? 'تنشيط حساب' : 'Reactivate'; }
          else if (log.action === 'tenant.update') { actionClass = 'plan-badge plan-enterprise'; actionLabel = currentLang === 'ar' ? 'تعديل عيادة' : 'Update Details'; }
          else if (log.action === 'tenant.update_features') { actionClass = 'plan-badge plan-enterprise'; actionLabel = currentLang === 'ar' ? 'تعديل صلاحيات' : 'Update Features'; }
          else if (log.action === 'tenant.delete') { actionClass = 'plan-badge plan-basic'; actionLabel = currentLang === 'ar' ? 'حذف عيادة' : 'Delete Clinic'; }
          else if (log.action === 'subscription.change') { actionClass = 'plan-badge plan-enterprise'; actionLabel = currentLang === 'ar' ? 'تعديل اشتراك' : 'Update Subscription'; }
          else if (log.action === 'user.password_reset') { actionClass = 'plan-badge plan-enterprise'; actionLabel = currentLang === 'ar' ? 'إعادة كلمة مرور' : 'Password Reset'; }

          row.innerHTML = `
            <td>
              <strong>${log.operator_name}</strong><br>
              <small class="text-muted" style="font-size: 10px;">ID: ${log.admin_id.substring(0, 8)}</small>
            </td>
            <td><span class="${actionClass}" style="font-size: 11px;">${actionLabel}</span></td>
            <td>
              <span class="specialty-label" style="font-size: 11px;">${log.target_type.toUpperCase()}</span><br>
              <small class="text-muted" style="font-size: 10px;">ID: ${log.target_id ? log.target_id.substring(0, 8) : '—'}</small>
            </td>
            <td><span class="audit-details-code" title="${log.details || ''}">${log.details || '—'}</span></td>
            <td><code>${log.ip_address}</code></td>
            <td><small>${dateStr}</small></td>
          `;
          auditLogsTableBody.appendChild(row);
        });
      } else {
        showToast(data.error.message, 'error');
      }
    } catch (error) {
      showToast(translations[currentLang].err_network, 'error');
    }
  });
}

const closeAuditLogsModal = () => {
  if (auditLogsModal) auditLogsModal.classList.add('hide');
};
if (auditCloseBtn) auditCloseBtn.addEventListener('click', closeAuditLogsModal);
if (auditDoneBtn) auditDoneBtn.addEventListener('click', closeAuditLogsModal);

// --- Clinic Details Hub Redirection ---
window.openClinicDetails = (id) => {
  window.location.href = `clinic_details.html?id=${id}`;
};

// --- Navigation Tab Panel Controls ---
// Removed switchOpsTab and initOpsTabFromUrl as we are using multi-page layout.

// Quick Actions Listeners
const btnQuickManagePlans = document.getElementById('btn-quick-manage-plans');
if (btnQuickManagePlans) {
  btnQuickManagePlans.addEventListener('click', () => {
    window.location.href = 'admin_plans.html';
  });
}
const btnQuickViewAudit = document.getElementById('btn-quick-view-audit');
if (btnQuickViewAudit) {
  btnQuickViewAudit.addEventListener('click', () => {
    if (viewAuditLogsBtn) viewAuditLogsBtn.click();
  });
}
const btnViewAllAudits = document.getElementById('btn-view-all-audits');
if (btnViewAllAudits) {
  btnViewAllAudits.addEventListener('click', () => {
    if (viewAuditLogsBtn) viewAuditLogsBtn.click();
  });
}

// --- Dynamic Plans Management Logic ---
let allPlans = [];

async function loadPlansTab() {
  const container = document.getElementById('ops-plans-cards-container');
  container.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: var(--text-muted);">جاري تحميل الباقات...</div>';
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/plans`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      allPlans = data.data;
      
      // Update the plan select in onboarding modal dynamically!
      const planSelect = document.getElementById('clinic-plan');
      if (planSelect) {
        planSelect.innerHTML = allPlans.map(p => `<option value="${p.id}">${p.name} ($${p.price_usd}/m)</option>`).join('');
      }

      container.innerHTML = '';
      allPlans.forEach(plan => {
        const card = document.createElement('div');
        card.className = 'plan-config-card';
        card.setAttribute('data-plan-id', plan.id);
        
        const badgeClass = plan.id === 'enterprise' ? 'plan-enterprise' : (plan.id === 'pro' ? 'plan-pro' : 'plan-basic');
        
        card.innerHTML = `
          <div>
            <div class="plan-config-header" onclick="window.toggleCardFeatures('${plan.id}')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px;">
              <span class="plan-config-title"><i class="fa-solid fa-gem" style="color: var(--primary);"></i> ${plan.name}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="plan-badge ${badgeClass}">${plan.id.toUpperCase()}</span>
                <i class="fa-solid fa-chevron-down plan-chevron" id="chevron-${plan.id}" style="font-size: 11px; color: var(--text-muted); transition: transform 0.2s ease;"></i>
              </div>
            </div>
            
            <div class="plan-config-price-box">
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">
                <span>السعر بالدولار:</span>
                <span>$${plan.price_usd}/شهر</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--text-main);">
                <span>السعر بالجنيه:</span>
                <span>${plan.price_egp} EGP/شهر</span>
              </div>
            </div>
            
            <ul class="plan-config-features-list hide" id="features-list-${plan.id}" style="margin-top: 12px; border-top: 1px dashed var(--input-border); padding-top: 10px;">
              <li><span>أطباء متعددون</span> ${plan.allow_multi_doctor ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>التأمين الطبي</span> ${plan.allow_insurance ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>الاسترداد التلقائي</span> ${plan.allow_refunds ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>تنبيهات واتساب</span> ${plan.allow_whatsapp ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>بوت تليجرام</span> ${plan.allow_telegram ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>تقارير تحليلات</span> ${plan.allow_analytics ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>حجز صوتي ذكي</span> ${plan.allow_voice_bot ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
              <li><span>هوية مخصصة</span> ${plan.allow_custom_branding ? '<i class="fa-solid fa-circle-check text-success"></i>' : '<i class="fa-solid fa-circle-xmark text-danger"></i>'}</li>
            </ul>
          </div>
          
          <button type="button" class="btn-secondary" onclick="editPlanConfig('${plan.id}')" style="margin-top: 16px; width: 100%; padding: 10px; font-size: 13px; font-family: 'Cairo'; justify-content: center; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-pen-to-square"></i> تعديل خصائص الباقة
          </button>
        `;
        container.appendChild(card);
      });
    }
  } catch (error) {
    container.innerHTML = '<div class="text-center text-danger" style="grid-column: 1/-1; padding: 40px;">فشل الاتصال بالخادم لجلب الباقات</div>';
  }
}

// Collapsible features function
window.toggleCardFeatures = (planId) => {
  const list = document.getElementById(`features-list-${planId}`);
  const chevron = document.getElementById(`chevron-${planId}`);
  if (list) {
    const isHidden = list.classList.toggle('hide');
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  }
};

// Edit specific plan details in configuration form
window.editPlanConfig = (planId) => {
  const plan = allPlans.find(p => p.id === planId);
  if (!plan) return;
  
  // Open configuration sidebar
  const sidebar = document.getElementById('plan-config-sidebar');
  if (sidebar) sidebar.classList.remove('hide');

  // Highlight active card
  document.querySelectorAll('.plan-config-card').forEach(card => {
    card.classList.remove('active-edit');
    if (card.getAttribute('data-plan-id') === planId) {
      card.classList.add('active-edit');
    }
  });

  const planIdEl = document.getElementById('plan-id');
  if (planIdEl) planIdEl.value = plan.id;
  
  const planNameEl = document.getElementById('plan-name-input');
  if (planNameEl) {
    planNameEl.value = plan.name;
    planNameEl.setAttribute('readonly', 'true');
    planNameEl.style.background = 'rgba(0,0,0,0.02)';
    planNameEl.style.cursor = 'not-allowed';
  }
  
  const formTitle = document.getElementById('plan-form-title');
  if (formTitle) {
    formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> تهيئة وتعديل الباقة';
  }
  
  const submitBtn = document.getElementById('plan-config-submit-btn');
  if (submitBtn) {
    const textEl = submitBtn.querySelector('.btn-text');
    if (textEl) textEl.innerText = 'حفظ خصائص الباقة';
  }

  const planPriceUsdEl = document.getElementById('plan-price-usd');
  if (planPriceUsdEl) planPriceUsdEl.value = plan.price_usd;
  const planPriceEgpEl = document.getElementById('plan-price-egp');
  if (planPriceEgpEl) planPriceEgpEl.value = plan.price_egp;
  
  const featMultiEl = document.getElementById('plan-feat-multi-doctor');
  if (featMultiEl) featMultiEl.checked = !!plan.allow_multi_doctor;
  const featInsEl = document.getElementById('plan-feat-insurance');
  if (featInsEl) featInsEl.checked = !!plan.allow_insurance;
  const featRefEl = document.getElementById('plan-feat-refunds');
  if (featRefEl) featRefEl.checked = !!plan.allow_refunds;
  const featWaEl = document.getElementById('plan-feat-whatsapp');
  if (featWaEl) featWaEl.checked = !!plan.allow_whatsapp;
  const featTgEl = document.getElementById('plan-feat-telegram');
  if (featTgEl) featTgEl.checked = !!plan.allow_telegram;
  const featAnEl = document.getElementById('plan-feat-analytics');
  if (featAnEl) featAnEl.checked = !!plan.allow_analytics;
  const featVbEl = document.getElementById('plan-feat-voice-bot');
  if (featVbEl) featVbEl.checked = !!plan.allow_voice_bot;
  const featBrandEl = document.getElementById('plan-feat-branding');
  if (featBrandEl) featBrandEl.checked = !!plan.allow_custom_branding;

  // Toggle delete button
  const deleteBtn = document.getElementById('plan-config-delete-btn');
  if (deleteBtn) {
    if (['basic', 'pro', 'enterprise'].includes(plan.id.toLowerCase())) {
      deleteBtn.style.display = 'none';
    } else {
      deleteBtn.style.display = 'inline-flex';
    }
  }
};

// Add New Plan trigger
const btnAddNewPlan = document.getElementById('btn-add-new-plan');
if (btnAddNewPlan) {
  btnAddNewPlan.addEventListener('click', () => {
    // Open configuration sidebar
    const sidebar = document.getElementById('plan-config-sidebar');
    if (sidebar) sidebar.classList.remove('hide');

    // Clear highlight
    document.querySelectorAll('.plan-config-card').forEach(card => card.classList.remove('active-edit'));

    const planIdEl = document.getElementById('plan-id');
    if (planIdEl) planIdEl.value = ''; // empty means create mode
    
    const planNameEl = document.getElementById('plan-name-input');
    if (planNameEl) {
      planNameEl.value = '';
      planNameEl.removeAttribute('readonly');
      planNameEl.style.background = 'var(--input-bg)';
      planNameEl.style.cursor = 'text';
      planNameEl.focus();
    }
    
    const formTitle = document.getElementById('plan-form-title');
    if (formTitle) {
      formTitle.innerHTML = '<i class="fa-solid fa-plus text-primary"></i> إضافة باقة جديدة';
    }
    
    const submitBtn = document.getElementById('plan-config-submit-btn');
    if (submitBtn) {
      const textEl = submitBtn.querySelector('.btn-text');
      if (textEl) textEl.innerText = 'إنشاء باقة جديدة';
    }

    const deleteBtn = document.getElementById('plan-config-delete-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    // Reset inputs
    document.getElementById('plan-price-usd').value = 0;
    document.getElementById('plan-price-egp').value = 0;
    document.getElementById('plan-feat-multi-doctor').checked = false;
    document.getElementById('plan-feat-insurance').checked = false;
    document.getElementById('plan-feat-refunds').checked = false;
    document.getElementById('plan-feat-whatsapp').checked = false;
    document.getElementById('plan-feat-telegram').checked = false;
    document.getElementById('plan-feat-analytics').checked = false;
    document.getElementById('plan-feat-voice-bot').checked = false;
    document.getElementById('plan-feat-branding').checked = false;
  });
}

// Plan form submit
const planForm = document.getElementById('ops-plan-config-form');
if (planForm) {
  planForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const planNameVal = document.getElementById('plan-name-input').value.trim();
    if (!planNameVal) {
      showToast('يرجى إدخال اسم الباقة', 'error');
      return;
    }
    
    let planId = document.getElementById('plan-id').value;
    const isNew = !planId;
    if (isNew) {
      // Generate ID
      planId = planNameVal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!planId || planId === '-') {
        // Fallback for non-ASCII characters (e.g. Arabic)
        planId = 'plan-' + Math.random().toString(36).substring(2, 7);
      }
    }
    
    showLoading('plan-config-submit-btn');
    const payload = {
      name: planNameVal,
      price_usd: parseInt(document.getElementById('plan-price-usd').value),
      price_egp: parseInt(document.getElementById('plan-price-egp').value),
      allow_multi_doctor: document.getElementById('plan-feat-multi-doctor').checked,
      allow_insurance: document.getElementById('plan-feat-insurance').checked,
      allow_refunds: document.getElementById('plan-feat-refunds').checked,
      allow_whatsapp: document.getElementById('plan-feat-whatsapp').checked,
      allow_telegram: document.getElementById('plan-feat-telegram').checked,
      allow_analytics: document.getElementById('plan-feat-analytics').checked,
      allow_voice_bot: document.getElementById('plan-feat-voice-bot').checked,
      allow_custom_branding: document.getElementById('plan-feat-branding').checked
    };

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        showToast(isNew ? 'تم إنشاء الباقة الجديدة بنجاح!' : 'تم تعديل خصائص الباقة وحفظها بنجاح!', 'success');
        const sidebar = document.getElementById('plan-config-sidebar');
        if (sidebar) sidebar.classList.add('hide');
        loadPlansTab();
      } else {
        showToast(data.error.message, 'error');
      }
    } catch (error) {
      showToast('خطأ في الاتصال بالخادم لحفظ التعديلات.', 'error');
    } finally {
      hideLoading('plan-config-submit-btn');
    }
  });
}

// Plan delete trigger
const deletePlanBtn = document.getElementById('plan-config-delete-btn');
if (deletePlanBtn) {
  deletePlanBtn.addEventListener('click', async () => {
    const planId = document.getElementById('plan-id').value;
    if (!planId) return;

    if (['basic', 'pro', 'enterprise'].includes(planId.toLowerCase())) {
      showToast('لا يمكن حذف باقات النظام الأساسية.', 'error');
      return;
    }

    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الباقة؟')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/v1/plans/${planId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم حذف الباقة بنجاح!', 'success');
        const sidebar = document.getElementById('plan-config-sidebar');
        if (sidebar) sidebar.classList.add('hide');
        loadPlansTab();
      } else {
        showToast(data.error.message, 'error');
      }
    } catch (e) {
      showToast('خطأ في الاتصال بالخادم لحذف الباقة.', 'error');
    }
  });
}

// Close form panel listener
const btnClosePlanConfig = document.getElementById('btn-close-plan-config');
if (btnClosePlanConfig) {
  btnClosePlanConfig.addEventListener('click', () => {
    const sidebar = document.getElementById('plan-config-sidebar');
    if (sidebar) sidebar.classList.add('hide');
    document.querySelectorAll('.plan-config-card').forEach(card => card.classList.remove('active-edit'));
  });
}

// --- Security Audit Logs Loading ---
async function loadHomeAuditLogs() {
  const tableBody = document.getElementById('home-audit-logs-body');
  if (!tableBody) return;
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/v1/audit-logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      const latest = data.data.slice(0, 5);
      if (latest.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding: 20px;">لا توجد عمليات أمان مسجلة.</td></tr>';
        return;
      }
      
      tableBody.innerHTML = '';
      latest.forEach(log => {
        const row = document.createElement('tr');
        const dateStr = new Date(log.created_at).toLocaleTimeString(currentLang === 'ar' ? 'ar-EG' : 'en-US');
        
        let actionLabel = log.action;
        let badgeClass = 'plan-badge plan-basic';
        if (log.action === 'tenant.create') { badgeClass = 'plan-badge plan-pro'; actionLabel = 'إنشاء عيادة'; }
        else if (log.action === 'tenant.deactivate') { badgeClass = 'plan-badge plan-basic'; actionLabel = 'تعليق حساب'; }
        else if (log.action === 'tenant.activate') { badgeClass = 'plan-badge plan-pro'; actionLabel = 'تنشيط حساب'; }
        else if (log.action === 'tenant.update') { badgeClass = 'plan-badge plan-enterprise'; actionLabel = 'تعديل عيادة'; }
        else if (log.action === 'tenant.update_features') { badgeClass = 'plan-badge plan-enterprise'; actionLabel = 'تعديل صلاحيات'; }
        else if (log.action === 'tenant.delete') { badgeClass = 'plan-badge plan-basic'; actionLabel = 'حذف عيادة'; }
        else if (log.action === 'plan.update_config') { badgeClass = 'plan-badge plan-enterprise'; actionLabel = 'تعديل باقة'; }
        
        row.innerHTML = `
          <td><strong>${log.operator_name}</strong></td>
          <td><span class="${badgeClass}" style="font-size: 10px;">${actionLabel}</span></td>
          <td><small class="audit-details-code">${log.details || '—'}</small></td>
          <td><small>${dateStr}</small></td>
        `;
        tableBody.appendChild(row);
      });
    }
  } catch (error) {
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger" style="padding: 20px;">فشل تحميل سجل العمليات.</td></tr>';
  }
}

// Attach quick actions listeners & refresh data on start
const btnQuickRefresh = document.getElementById('btn-quick-refresh-data');
if (btnQuickRefresh) {
  btnQuickRefresh.addEventListener('click', () => {
    loadDashboardData();
    loadHomeAuditLogs();
    showToast('تم تحديث الإحصائيات وسجل العمليات بنجاح!', 'success');
  });
}

// --- Page Initialization Routine ---
applyTranslation();

// Identify current page by checking which tab panels are present
if (panelHome) {
  // We are on admin.html (Home)
  loadDashboardData();
  loadHomeAuditLogs();
} else if (panelClinics) {
  // We are on admin_clinics.html (Clinics)
  loadDashboardData();
  // Check if we need to auto-open onboarding modal (from Home page quick action)
  const action = new URLSearchParams(window.location.search).get('action');
  if (action === 'add') {
    const addModal = document.getElementById('add-clinic-modal');
    if (addModal) {
      addModal.classList.remove('hide');
    }
  }
} else if (panelPlans) {
  // We are on admin_plans.html (Plans)
  loadPlansTab();
}

// Fetch plans for onboarding selects if they exist on the page
const planSelect = document.getElementById('clinic-plan');
if (planSelect) {
  const updatePlanPreview = () => {
    const selectedPlanId = planSelect.value;
    const plan = allPlans.find(p => p.id === selectedPlanId);
    const previewDiv = document.getElementById('plan-features-preview');
    if (!previewDiv) return;
    
    if (plan) {
      const feats = [];
      if (plan.allow_multi_doctor) feats.push("أطباء متعددون");
      if (plan.allow_insurance) feats.push("تأمين طبي");
      if (plan.allow_refunds) feats.push("استرداد تلقائي");
      if (plan.allow_whatsapp) feats.push("تنبيهات واتساب");
      if (plan.allow_telegram) feats.push("بوت تليجرام");
      if (plan.allow_analytics) feats.push("تحليلات وتقارير");
      if (plan.allow_voice_bot) feats.push("حجز صوتي ذكي");
      if (plan.allow_custom_branding) feats.push("هوية مخصصة");
      
      previewDiv.style.display = 'block';
      previewDiv.innerHTML = `<strong>صلاحيات الباقة المختارة:</strong> ${feats.join(' — ') || 'لا توجد خصائص إضافية'}`;
    } else {
      previewDiv.style.display = 'none';
    }
  };

  planSelect.addEventListener('change', updatePlanPreview);

  fetch(`${API_BASE_URL}/admin/v1/plans`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        allPlans = data.data;
        planSelect.innerHTML = allPlans.map(p => `<option value="${p.id}">${p.name} ($${p.price_usd}/m)</option>`).join('');
        updatePlanPreview();
      }
    }).catch(() => {});
}

