# 🏥 منصة عيادتي الذكية (Smart Clinic OS - SCS)

مرحباً بك في المستودع المنظم لمستندات ومخططات منصة عيادتي الذكية. تم تنظيم المجلدات لتكون مهنية وسهلة التصفح ومطابقة لأحدث المعايير البرمجية.

---

## 📁 هيكلية المجلدات المنظمة (Directory Structure)

```text
SCS/
├── 📁 docs/           # كافة مستندات مواصفات وبنية وقواعد عمل النظام (13 مستنداً)
├── 📁 diagrams/       # المخططات الهندسية والإنفوجرافيكس المحدثة (5 صور PNG)
├── 📁 mock-server/    # بيئة خادم الاختبار المحاكي وواجهة Swagger UI التفاعلية
└── 📄 README.md       # هذا الملف التعريفي بالمشروع
```

---

## 🗺️ خريطة المجلدات والتصفح (Workspace Navigator)

### 1. 📁 المستندات والكتالوجات الطبية والتقنية (`/docs`)
يحتوي هذا المجلد على المواصفات الشاملة المحدثة وفق المتطلبات الأخيرة:
- **[دليل النظام الرئيسي (smart_clinic_system_spec.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/smart_clinic_system_spec.md):** مواصفات المتطلبات وقصص المستخدمين.
- **[البنية البرمجية والتحتية (01_system_architecture.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/01_system_architecture.md):** تفاصيل البنية والنشر الخاص بـ VPN للأدمن.
- **[نموذج البيانات والـ ERD (02_data_model_erd.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/02_data_model_erd.md):** مخطط العلاقات وقاعدة البيانات وحقول الإشعارات.
- **[سير العمل ورحلات المستخدمين (03_user_flows.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/03_user_flows.md):** رحلة المريض والطبيب والسكرتاريا.
- **[مواصفات الـ APIs والـ Endpoints (04_api_specification.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/04_api_specification.md):** مواصفات واجهات البرمجة وقنوات التنبيه.
- **[واجهات السكرتاريا والأدمن (05_wireframes_ui.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/05_wireframes_ui.md):** تخطيط الشاشات واللوحات الإدارية.
- **[التكاملات الخارجية والبريد (06_external_integrations.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/06_external_integrations.md):** ربط الواتساب وتليجرام والـ Email Providers.
- **[الحماية والأمان والامتثال (07_security_compliance.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/07_security_compliance.md):** التشفير، الامتثال لـ HIPAA وقوانين مصر الرقمية.
- **[قواعد وحالات العمل التشغيلية (08_business_rules.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/08_business_rules.md):** شروط التسويق وعدادات الإلغاء والتقارير.
- **[خطة التنفيذ ومخطط العمليات (09_phased_roadmap.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/09_phased_roadmap.md):** خطة الموديولات والمراحل الأربعة للتنفيذ.
- **[دليل المخططات الهندسية (10_visual_diagrams.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/10_visual_diagrams.md):** مجمع مخططات Mermaid البرمجية.
- **[مخطط عمليات البيزنس BPMN (bpmn_business_process.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/bpmn_business_process.md):** التفاصيل التشغيلية لسير العمل.
- **[دليل التطوير وخادم الاختبار (testing_and_roadmap_guide.md)](file:///c:/Users/hmohamed/Downloads/SCS/docs/testing_and_roadmap_guide.md):** دليل عربي شامل للموديولات وسرعة البدء بالتجربة.

### 2. 📁 المخططات الرسومية والإنفوجرافيكس المحدثة (`/diagrams`)
- **[الهيكل وصلاحيات الأدوار (diagrams_roles_hierarchy.png)](file:///c:/Users/hmohamed/Downloads/SCS/diagrams/diagrams_roles_hierarchy.png)**
- **[البنية البرمجية والتحتية (diagrams_system_architecture.png)](file:///c:/Users/hmohamed/Downloads/SCS/diagrams/diagrams_system_architecture.png)**
- **[مخطط رحلة المريض (diagrams_patient_journey.png)](file:///c:/Users/hmohamed/Downloads/SCS/diagrams/diagrams_patient_journey.png)**
- **[فلو عمليات الدفع والمهل (diagrams_payment_flow.png)](file:///c:/Users/hmohamed/Downloads/SCS/diagrams/diagrams_payment_flow.png)**
- **[مخطط العمليات الشامل BPMN (diagrams_bpmn_full_process.png)](file:///c:/Users/hmohamed/Downloads/SCS/diagrams/diagrams_bpmn_full_process.png)**

### 3. 📁 خادم الاختبار المحاكي وواجهة Swagger (`/mock-server`)
لتجربة الروابط وواجهات الـ API التفاعلية:
- **[openapi.yaml](file:///c:/Users/hmohamed/Downloads/SCS/mock-server/openapi.yaml):** ملف Swagger لتوصيف المسارات.
- **[mock_server.js](file:///c:/Users/hmohamed/Downloads/SCS/mock-server/mock_server.js):** كود السيرفر المحاكي بـ Node.js/Express.
- **[package.json](file:///c:/Users/hmohamed/Downloads/SCS/mock-server/package.json):** مكونات تشغيل الخادم.

---

## ⚡ التشغيل السريع لخادم الاختبار (Quick Start)

لتجربة الروابط ورؤية ردود JSON تفاعلية على جهازك:

1. افتح موجه الأوامر (Terminal) وتوجه إلى مجلد السيرفر:
   ```bash
   cd mock-server
   ```
2. قم بتثبيت المكتبات المطلوبة:
   ```bash
   npm install
   ```
3. قم بتشغيل خادم الاختبار:
   ```bash
   npm start
   ```
4. افتح المتصفح وتصفح واجهة **Swagger UI** التفاعلية:
   👉 **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**
