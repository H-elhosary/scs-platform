# 📊 دليل المخططات والرسومات الهندسية للمشروع (Complete System Diagrams Guide)
**الإصدار:** 1.0  
**التاريخ:** 2026-07-01  
**المستند:** 10 من 10

---

## 1. نظرة عامة (Overview)

يجمع هذا المستند **كل المخططات والرسومات الهندسية الهامة** للمشروع بنظام **Mermaid** التفاعلي. تغطي هذه المخططات الجوانب التشغيلية، والبرمجية، وبنية البيانات ليكون مرجعاً مرئياً سريعاً للمطورين ومحللي النظام.

---

## 2. مخطط العمليات الشامل (BPMN 2.0 Business Process Diagram)

يوضح هذا المخطط حارات الأدوار المختلفة والرسائل المتبادلة بين المريض، البوت، السكرتير، الطبيب وبوابة الدفع:

```mermaid
graph TB
    %% Styling
    classDef startEnd fill:#F1F5F9,stroke:#64748B,stroke-width:2px;
    classDef task fill:#E2E8F0,stroke:#475569,stroke-width:1.5px;
    classDef gateway fill:#FEF3C7,stroke:#D97706,stroke-width:1.5px;
    classDef external fill:#EEF2FF,stroke:#4F46E5,stroke-width:1.5px;

    subgraph Pool_Patient ["👤 المريض (Patient)"]
        Pat_Start((🟢 Start)):::startEnd --> Pat_Msg[إرسال رسالة ترحيب للبوت]:::task
        Pat_Msg --> Pat_ChooseSlot[استقبال المواعيد واختيار Slot]:::task
        Pat_ChooseSlot --> Pat_PaySelect{قرار الدفع}:::gateway
        Pat_PaySelect -- أونلاين --> Pat_PayOnline[الدفع بالفيزا/المحفظة]:::task
        Pat_PaySelect -- كاش بالعيادة --> Pat_Arrive[الحضور للعيادة في الموعد]:::task
        Pat_PayOnline --> Pat_ReceiveConf[استقبال رسالة تأكيد الحجز]:::task
        Pat_ReceiveConf --> Pat_Arrive
        Pat_Arrive --> Pat_Wait[الانتظار في الاستراحة ومراقبة شاشة الـ TV]:::task
        Pat_Wait --> Pat_Called[سماع النداء الصوتي والتوجه لغرفة الطبيب]:::task
        Pat_Called --> Pat_Examined[الخضوع للفحص والتشخيص]:::task
        Pat_Examined --> Pat_ReceiveRx[استقبال الروشتة PDF على الواتساب]:::task
        Pat_ReceiveRx --> Pat_End((🔴 End)):::startEnd
    end

    subgraph Pool_Bot ["🤖 البوت الآلي (Multi-Channel Bot: WhatsApp + Telegram)"]
        Bot_Triage[فحص الهاتف والفرز الطبي Triage]:::task --> Bot_TriageGate{هل الحالة حرجة؟}:::gateway
        Bot_TriageGate -- نعم 🚨 --> Bot_Emergency[إرسال تحذير الطوارئ وإنهاء الجلسة]:::task
        Bot_TriageGate -- لا --> Bot_ShowSlots[عرض الـ Slots المتاحة لحظياً]:::task
        Bot_ShowSlots --> Bot_LockSlot[قفل الـ Slot مؤقتاً في Redis]:::task
        Bot_LockSlot --> Bot_GenInvoice[إنشاء فاتورة ورابط الدفع Paymob]:::task
        Bot_GenInvoice --> Bot_TimeoutTimer{بدء مؤقت إلغاء الحجز}:::gateway
        Bot_TimeoutTimer -- انتهى الوقت بدون سداد --> Bot_Cancel[إلغاء الحجز وتحرير الـ Slot وإرسال إشعار]:::task
        Bot_TimeoutTimer -- وصل إشعار سداد ناجح --> Bot_Confirm[تأكيد الموعد وإرسال كود الحجز]:::task
    end

    subgraph Pool_Secretary ["👩‍💼 السكرتاريا والاستقبال (Secretary)"]
        Sec_CheckIn[تسجيل حضور المريض Checked-In]:::task --> Sec_UpdateQueue[إدراج المريض في قائمة الانتظار العامة]:::task
        Sec_UpdateQueue --> Sec_WaitingTV[تحديث شاشة الـ TV عبر WebSockets]:::task
        Sec_WaitingTV -.-> Pat_Wait
        Sec_ManageConflicts[حل نزاعات حجز الأوفلاين يدوياً]:::task
        Sec_CashCollect[تحصيل كاش وتأكيد فواتير الخدمات الإضافية]:::task
    end

    subgraph Pool_Doctor ["👨‍⚕️ الطبيب (Doctor)"]
        Doc_NextBtn[الضغط على زر المريض التالي]:::task --> Doc_Chime[إطلاق جرس التنبيه الصوتي بالشاشة]:::task
        Doc_Chime -.-> Pat_Called
        Doc_NextBtn --> Doc_OpenFile[فتح السجل الطبي SOAP للمريض النشط]:::task
        Doc_OpenFile --> Doc_Diagnosis[تدوين الفحص والتشخيص ICD-11]:::task
        Doc_Diagnosis --> Doc_Prescription[كتابة الروشتة واعتمادها بالتوقيع الرقمي]:::task
        Doc_Prescription --> Doc_Save[إغلاق ملف الزيارة وحفظ السجل مشفر]:::task
        Doc_Save --> Doc_ExtraService{هل توجد خدمات إضافية؟}:::gateway
        Doc_ExtraService -- نعم --> Doc_AddInvoice[إصدار فاتورة إضافية وإرسالها للسكرتير]:::task
        Doc_ExtraService -- لا --> Doc_DocEnd((End)):::startEnd
        Doc_AddInvoice -.-> Sec_CashCollect
    end

    subgraph Pool_Payment ["💳 بوابة الدفع (Payment Gateway)"]
        Pay_Process[معالجة عملية الدفع]:::task --> Pay_Webhook[إرسال Webhook بالدفع الناجح]:::task
    end

    Pat_Msg -.-> Bot_Triage
    Bot_ShowSlots -.-> Pat_ChooseSlot
    Pat_PayOnline -.-> Pay_Process
    Pay_Webhook -.-> Bot_Confirm
    Bot_Confirm -.-> Pat_ReceiveConf
    Pat_Arrive -.-> Sec_CheckIn
    Doc_Prescription -.-> Pat_ReceiveRx
    Doc_AddInvoice -.-> Sec_CashCollect
```

---

## 3. مخطط آلة الحالات للبوت متعدد القنوات (Multi-Channel Bot State Machine Diagram: WhatsApp + Telegram)

يوضح هذا المخطط الانتقال بين الحالات المختلفة (States) للمحادثة بناءً على مدخلات المريض:

```mermaid
stateDiagram-v2
    [*] --> IDLE : استقبال رسالة ترحيبية
    
    IDLE --> ONBOARDING_NAME : المريض غير مسجل (طلب الاسم بالكامل)
    IDLE --> TRIAGE : المريض مسجل (طلب الشكوى مباشرة)
    
    ONBOARDING_NAME --> ONBOARDING_AGE : المريض يرسل الاسم
    ONBOARDING_AGE --> ONBOARDING_GENDER : المريض يرسل السن
    ONBOARDING_GENDER --> TRIAGE : المريض يحدد الجنس
    
    TRIAGE --> EMERGENCY_BLOCK : الشكوى تحتوي على كلمات طوارئ حرجة 🚨
    TRIAGE --> BOOKING_DAY : الشكوى طبيعية (عرض الأيام المتاحة)
    
    BOOKING_DAY --> BOOKING_SLOT : اختيار اليوم (عرض الساعات)
    BOOKING_SLOT --> PAYMENT_PENDING : اختيار الساعة (قفل الـ Slot وتوليد رابط الدفع)
    
    PAYMENT_PENDING --> CONFIRMED : سداد ناجح (Webhook)
    PAYMENT_PENDING --> IDLE : انتهاء المهلة دون سداد (تحرير الـ Slot)
    
    CONFIRMED --> [*] : إرسال كود التأكيد والموقع وتأكيد الموعد
    EMERGENCY_BLOCK --> [*] : التوجيه لأقرب مستشفى طوارئ
    
    state MANUAL_MODE {
        [*] --> Bot_Disabled : تدخل يدوي من السكرتير
        Bot_Disabled --> Bot_Enabled : انتهاء الـ 60 دقيقة / تفعيل يدوي
    }
    
    IDLE --> MANUAL_MODE
    TRIAGE --> MANUAL_MODE
    BOOKING_DAY --> MANUAL_MODE
    PAYMENT_PENDING --> MANUAL_MODE
    MANUAL_MODE --> IDLE : عودة التحكم للبوت تلقائياً
```

---

## 4. مخطط الكيانات والعلاقات التفصيلي لقاعدة البيانات (Detailed ERD)

مخطط يوضح الجداول الأساسية والعلاقات ومفاتيح الربط والـ Multi-tenancy:

```mermaid
erDiagram
    ADMIN_USERS ||--o{ ADMIN_SESSIONS : "manages"
    ADMIN_USERS ||--o{ TENANTS : "creates"
    
    TENANTS ||--o{ USERS : "contains"
    TENANTS ||--o{ PATIENTS : "manages"
    TENANTS ||--o{ SERVICES : "offers"
    TENANTS ||--o{ APPOINTMENTS : "schedules"
    TENANTS ||--o{ CONVERSATIONS : "logs"
    TENANTS ||--o{ INVOICES : "bills"
    TENANTS ||--o{ TENANT_USAGE_STATS : "tracks"
    
    USERS ||--o{ APPOINTMENTS : "manages"
    USERS }o--|| ROLES : "has"
    ROLES ||--o{ ROLE_PERMISSIONS : "grants"
    
    PATIENTS ||--o{ APPOINTMENTS : "books"
    PATIENTS ||--o{ MEDICAL_RECORDS : "owns"
    PATIENTS ||--o{ CONVERSATIONS : "has"
    PATIENTS ||--o{ INVOICES : "receives"
    
    APPOINTMENTS ||--|| INVOICES : "generates"
    APPOINTMENTS }o--|| SERVICES : "requires"
    APPOINTMENTS }o--|| TIME_SLOTS : "occupies"
    
    MEDICAL_RECORDS ||--o{ PRESCRIPTIONS : "contains"
    MEDICAL_RECORDS ||--o{ PATIENT_IMAGES : "has"
    MEDICAL_RECORDS ||--o{ DENTAL_CHARTS : "records"
    
    PRESCRIPTIONS ||--o{ PRESCRIPTION_ITEMS : "details"
    PRESCRIPTION_ITEMS }o--|| MEDICATIONS : "references"
    
    CONVERSATIONS ||--o{ CONVERSATION_MESSAGES : "contains"
```

---

## 5. مخطط معالجة طلبات الـ Multi-Tenant وعزل البيانات (RLS Flow)

يوضح كيف يتدفق الـ Request ويتأكد السيرفر وقاعدة البيانات من عزل بيانات العيادة (`tenant_id`):

```mermaid
sequenceDiagram
    autonumber
    actor Client as PWA / Client App
    participant ApiGate as API Gateway
    participant AuthMW as Auth Middleware
    participant PG as PostgreSQL (RLS Enabled)

    Client->>ApiGate: GET /api/v1/patients (with JWT Token)
    activate ApiGate
    ApiGate->>AuthMW: التحقق من التوقيع وصلاحية الـ Token
    activate AuthMW
    AuthMW->>AuthMW: فك تشفير الـ Token واستخراج: user_id, tenant_id, permissions
    deactivate AuthMW
    
    ApiGate->>PG: 1. SET app.current_tenant = 'tenant_uuid'
    activate PG
    Note over PG: يتم تفعيل متغير الجلسة بالـ tenant_id الخاص بالعيادة
    ApiGate->>PG: 2. SELECT * FROM patients;
    Note over PG: يتم تطبيق الـ RLS Policy تلقائياً:<br/>WHERE tenant_id = app.current_tenant
    PG-->>ApiGate: إعادة قائمة المرضى الخاصة بهذه العيادة فقط
    deactivate PG
    
    ApiGate-->>Client: إرسال البيانات المنسقة JSON
    deactivate ApiGate
```

---

## 6. مخطط المزامنة أوفلاين وفض تعارض الحجز المزدوج (Offline Sync & Conflict Resolution)

يوضح كيف تعمل قائمة الانتظار للمزامنة عند عودة الإنترنت وتنبيهات السكرتير بالتعارض:

```mermaid
graph TD
    %% Styling
    classDef offline fill:#FEE2E2,stroke:#EF4444,stroke-width:1.5px;
    classDef online fill:#D1FAE5,stroke:#10B981,stroke-width:1.5px;
    classDef action fill:#E2E8F0,stroke:#475569,stroke-width:1.5px;

    %% Steps
    A[🔴 انقطاع الإنترنت بالعيادة]:::offline --> B[السكرتير يحجز موعداً كاش بالعيادة]:::action
    B --> C[حفظ الموعد محلياً في IndexedDB]:::action
    C --> D[إضافة العملية في طابور العمليات المعلقة Pending Queue]:::action
    
    D --> E[🟢 عودة الإنترنت بالعيادة]:::online
    E --> F[Service Worker يرسل الطابور المعلق للسيرفر]:::action
    
    F --> G{فحص تعارض الـ Slot: هل حُجز نفس الوقت أونلاين؟}:::gateway
    G -- لا يوجد تعارض --> H[حفظ الموعد بنجاح على السيرفر]:::online
    H --> I[تفريغ طابور العمليات المحلية المعلقة]:::action
    
    G -- يوجد تعارض حجز مزدوج ⚠️ --> J[إنشاء سجل تعارض في جدول sync_conflicts]:::offline
    J --> K[إظهار الحجزين المتعارضين معاً في الكاليندر]:::offline
    K --> L[إطلاق تنبيه أحمر وامض للسكرتير]:::offline
    L --> M[السكرتير يتصل بالمرضى ويعدل أحد المواعيد يدوياً]:::action
    M --> I
```

