# 🔄 مستند مخططات سير العمل ورحلات المستخدمين (User Flow Diagrams)
**الإصدار:** 1.0  
**التاريخ:** 2026-07-01  
**المستند:** 3 من 9

---

## 1. نظرة عامة (Overview)

يوثق هذا المستند رحلات المستخدمين المختلفة داخل النظام (مريض، سكرتير، طبيب، ومشغل النظام/صاحب السيستم). نستخدم مخططات **Mermaid** لتوضيح تسلسل الخطوات، القرارات، والتفاعلات بين الأنظمة المختلفة والواجهات.

---

## 2. رحلات مشغل/صاحب النظام (Platform Operator / System Owner Flows)

### 2.1 رحلة إضافة عيادة جديدة وتفعيل الاشتراك (Clinic Onboarding & Subscription Activation)
يوضح هذا المسار كيف يقوم صاحب النظام (Platform Admin) بإنشاء عيادة جديدة وتوليد حساب الطبيب الأول لها.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 🏢 مشغل النظام (Platform Owner)
    participant DB as 🐘 قاعدة البيانات
    participant Queue as 📬 Queue / Worker
    participant Mail as 📧 Server (Email Service)
    actor Doc as 👨‍⚕️ الطبيب (Clinic Owner)

    Admin->>Admin: تسجيل الدخول إلى لوحة تحكم المشغل (2FA)
    Admin->>Admin: تعبئة مصنع العيادات (اسم العيادة، تخصص، هاتف، إيميل الطبيب)
    Admin->>Admin: تحديد خطة الاشتراك (مثال: Pro - سنة كاملة)
    Admin->>DB: إرسال طلب الإنشاء (POST /api/admin/tenants)
    activate DB
    DB->>DB: إنشاء سجل Tenant فريد (tenant_id)
    DB->>DB: إنشاء حساب المستخدم الطبيب بـ Role = Owner
    DB->>DB: تسجيل خطة الاشتراك والـ Expiry Date
    DB-->>Admin: تأكيد الإنشاء بنجاح
    deactivate DB
    
    Admin->>Queue: إطلاق خطوة الترحيب وإرسال التفعيل
    activate Queue
    Queue->>DB: توليد Token استعادة وتفعيل فريد (صالح لـ 24 ساعة)
    Queue->>Mail: أمر إرسال بريد التفعيل
    deactivate Queue
    activate Mail
    Mail-->>Doc: بريد إلكتروني: "مرحباً بك في Smart Clinic OS، اضغط هنا لتعيين كلمة مرورك وتفعيل عيادتك"
    deactivate Mail
    
    Doc->>Doc: الضغط على الرابط في البريد
    Doc->>Admin: إدخال كلمة مرور قوية جديدة
    Admin->>DB: تفعيل الحساب وتعيين كلمة المرور المشفرة
    DB-->>Doc: تفعيل ناجح وتحويل إلى لوحة تحكم العيادة ✅
```

---

## 3. رحلات الطبيب مالك العيادة (Doctor / Clinic Owner Flows)

### 3.1 رحلة إعداد العيادة وإضافة سكرتير (Clinic Setup & Staff Onboarding)
بعد دخول الطبيب للنظام لأول مرة، يجب عليه تهيئة النظام لتشغيل البوت وإضافة مساعديه.

```mermaid
flowchart TD
    Start([دخول الطبيب للوحة التحكم]) --> CheckConfig{هل إعدادات العيادة مكتملة؟}
    
    CheckConfig -- لا --> SetSettings[1. ضبط إعدادات العيادة: الاسم، التخصص، Timezone]
    SetSettings --> AddServices[2. إضافة الخدمات الطبية: سعر الكشف، مدة الجلسة]
    AddServices --> ConfigHours[3. تحديد ساعات العمل الأسبوعية لكل يوم]
    ConfigHours --> ConnectWA[4. ربط قنوات المحادثة: WhatsApp Business API و/أو Telegram Bot]
    ConnectWA --> SetupDone[إعدادات النظام جاهزة]
    
    CheckConfig -- نعم --> SetupDone
    
    SetupDone --> AddStaff[إضافة حساب سكرتير جديد]
    AddStaff --> InputStaffDetails[إدخال اسم السكرتير، إيميل، ورقم هاتف]
    InputStaffDetails --> AssignRole[تحديد دور 'سكرتير' وتخصيص الصلاحيات الديناميكية]
    AssignRole --> SaveStaff[حفظ وإرسال كود التفعيل للسكرتير]
    SaveStaff --> End([السكرتير يبدأ تسجيل الدخول والعمل])
```

### 3.2 رحلة فحص المريض وكتابة الروشتة الذكية (Clinical Exam & E-Prescription Flow)
تبدأ عندما يدخل المريض لغرفة الكشف وحتى إرسال الروشتة إلى هاتفه تلقائياً.

```mermaid
sequenceDiagram
    autonumber
    actor Doc as 👨‍⚕️ الطبيب
    participant DB as 🐘 قاعدة البيانات
    participant PDF as 📄 PDF Generator Service
    participant Queue as 📬 Job Queue (Redis Bull)
    actor Pat as 💬 المريض (على الواتساب)

    Doc->>Doc: فتح ملف المريض النشط في غرفة الكشف (التدفق من لوحة الانتظار)
    Doc->>Doc: تعبئة السجل الطبي بنظام SOAP
    Note over Doc: Subjective: الشكوى<br/>Objective: العلامات الحيوية<br/>Assessment: التشخيص (ICD-11)<br/>Plan: الروشتة والعلاج
    
    Doc->>Doc: كتابة الأدوية (Autocomplete من قاعدة الأدوية المحلية)
    Doc->>Doc: الضغط على "اعتماد وحفظ الروشتة والزيارة"
    
    Doc->>DB: إرسال البيانات (POST /api/medical-records)
    activate DB
    DB->>DB: حفظ السجل الطبي (SOAP Notes) مشفر بـ AES-256
    DB->>DB: تحديث إحصائيات المريض (زيارة جديدة، إلخ)
    DB-->>Doc: تأكيد الحفظ بنجاح
    deactivate DB

    Doc->>PDF: أمر توليد الروشتة الإلكترونية
    activate PDF
    PDF->>PDF: إنشاء ملف PDF منسق بشعار العيادة
    PDF->>PDF: توليد QR Code يحتوي على التوقيع الرقمي لمنع التزوير
    PDF->>PDF: حفظ الروشتة في Object Storage (S3)
    PDF-->>Doc: عرض الروشتة على الشاشة للطبيب
    deactivate PDF

    Doc->>Queue: إضافة مهمة إرسال الروشتة (Background Job)
    activate Queue
    Queue->>Pat: إرسال رسالة واتساب: "تم اعتماد روشتتك للزيارة رقم X بملف PDF مرفق ورابط للتحقق"
    deactivate Queue
```

---

## 4. رحلات السكرتاريا (Secretary / Desk Operations Flows)

### 4.1 رحلة التدخل اليدوي وإيقاف البوت مؤقتاً (Manual Takeover Flow)
حماية للمريض من الردود المزدوجة عندما يحتاج السكرتير للرد بنفسه.

```mermaid
flowchart TD
    NewMsg[وصول رسالة من مريض على الواتساب] --> CheckBot{هل البوت نشط لهذا الشات؟}
    
    CheckBot -- نعم --> BotProcess[البوت يعالج ويرد تلقائياً]
    
    CheckBot -- لا (وضع يدوي) --> InboxAlert[تظهر الرسالة في صندوق الوارد الموحد للسكرتير]
    InboxAlert --> SecReply[يقوم السكرتير بكتابة رد يدوي]
    SecReply --> SendMsg[إرسال الرسالة للمريض مباشرة دون تدخل البوت]
    
    BotProcess --> SecInspect[السكرتير يلاحظ صعوبة في فهم البوت للعميل]
    SecInspect --> ClickToggle[الضغط على زر 'تعطيل البوت' في المحادثة]
    ClickToggle --> SetManualMode[تحويل الشات إلى MANUAL_MODE في Redis/DB]
    SetManualMode --> StartTimer[تفعيل مؤقت تنازلي لـ 1 ساعة تلقائياً]
    StartTimer --> InboxAlert
    
    StartTimer --> TimerExpires{هل انتهت الساعة دون تمديد؟}
    TimerExpires -- نعم --> ReactivateBot[إعادة تفعيل البوت تلقائياً]
    TimerExpires -- لا / السكرتير ضغط تفعيل يدوياً --> ReactivateBot
    ReactivateBot --> BotProcess
```

### 4.2 رحلة العمل دون اتصال والمزامنة (Offline Work & Sync Resolution)

```mermaid
sequenceDiagram
    autonumber
    actor Sec as 👩‍💼 السكرتير (Dashboard)
    participant SW as ⚙️ Service Worker / IndexDB
    participant REST as 📡 Server REST API
    participant DB as 🐘 PostgreSQL (Server)

    Note over Sec,DB: 🔴 انقطع الإنترنت بالكامل في العيادة
    Sec->>Sec: محاولة حجز موعد جديد لمريض حاضر
    Sec->>SW: إرسال طلب الحجز
    activate SW
    SW->>SW: التحقق من اتصال الشبكة (Offline)
    SW->>SW: حفظ الحجز في Local IndexedDB (جدول المواعيد)
    SW->>SW: إضافة العملية في طابور العمليات المعلقة (Pending Queue)
    SW-->>Sec: إشعار أصفر: "تم الحفظ محلياً - تعمل أوفلاين" ✅
    deactivate SW
    
    Note over Sec,DB: 🟢 عاد الاتصال بالإنترنت
    SW->>SW: Service Worker يستشعر عودة الشبكة (online event)
    SW->>REST: إرسال العمليات المعلقة بالترتيب (POST /api/sync)
    activate REST
    REST->>DB: فحص تعارض الموعد (هل حُجز نفس الوقت أونلاين؟)
    
    alt لا يوجد تعارض
        DB->>DB: إدراج الموعد وحفظه نهائياً
        REST-->>SW: تم المزامنة بنجاح 200 OK
        SW->>SW: مسح العملية من طابور IndexedDB المعلق
        SW-->>Sec: إشعار: "تمت مزامنة كل البيانات المعلقة"
    else يوجد تعارض (الموعد حجز بالخارج عبر البوت)
        DB-->>REST: تعارض مكتشف (409 Conflict)
        REST-->>SW: فشل المزامنة بسبب تعارض الحجز
        SW->>SW: نقل السجل إلى جدول نزاعات المزامنة (sync_conflicts)
        SW-->>Sec: إشعار أحمر 🚨: "يوجد تعارض في حجز الساعة 10:00 - يرجى فض النزاع يدوياً"
    end
    deactivate REST
```

---

## 5. رحلات المريض عبر البوت (Multi-Channel Patient Journey Flows: WhatsApp + Telegram)

### 5.1 رحلة الترحيب والفرز الطبي التلقائي (Onboarding & Triage Flow)

```mermaid
flowchart TD
    Start([المريض يرسل رسالة 'مرحباً' أو أي نص للبوت]) --> CheckPhone{هل رقم الهاتف مسجل بالعيادة؟}
    
    CheckPhone -- نعم --> WelcomeRegistered[الترحيب بالمريض باسمه الثنائي وعرض القائمة الأساسية]
    CheckPhone -- لا --> Onboarding[بدء جمع البيانات بالتسلسل]
    
    Onboarding --> GetName[طلب الاسم بالكامل]
    GetName --> GetAge[طلب السن]
    GetAge --> GetGender[طلب الجنس]
    GetGender --> CreateProfile[إنشاء ملف طبي أولي للمريض تلقائياً]
    CreateProfile --> AskComplaint[طلب وصف الشكوى أو الأعراض الحالية]
    
    WelcomeRegistered --> SelectBooking[المريض يختار حجز موعد جديد]
    SelectBooking --> AskComplaint
    
    AskComplaint --> CheckTriage{هل الشكوى تحتوي على كلمات طوارئ حرجة؟<br/>'ألم حاد بالصدر، ضيق تنفس، نزيف مستمر'}
    
    CheckTriage -- نعم (حرجة 🚨) --> EmergencyAlert[إيقاف عملية الحجز فوراً وعرض رسالة تحذيرية حمراء والتوجه للطوارئ]
    CheckTriage -- لا --> CheckMultiDoctor{هل العيادة تدعم أطباء متعددين؟<br/>allow_multi_doctor == true}

    CheckMultiDoctor -- نعم --> AskDoctor[عرض قائمة الأطباء المتاحين كأزرار تفاعلية واختيار الطبيب]
    CheckMultiDoctor -- لا --> SetSingleDoctor[اختيار الطبيب الأساسي تلقائياً]

    AskDoctor --> AskVisitType[طلب تحديد نوع الزيارة: كشف جديد أم متابعة مجانية؟]
    SetSingleDoctor --> AskVisitType
```

### 5.2 رحلة الحجز والدفع الإلكتروني المؤقت (Booking & Payment Journey)

```mermaid
sequenceDiagram
    autonumber
    actor Pat as 💬 المريض (على الواتساب/تليجرام)
    participant Bot as 🤖 Multi-Channel Bot Engine
    participant DB as 🐘 قاعدة البيانات / Redis
    participant Pay as 💳 بوابة الدفع (Paymob/Fawry)

    Bot->>DB: طلب المواعيد المتاحة للطبيب المختار (Real-time slots)
    DB-->>Bot: قائمة بالـ Slots الشاغرة للطبيب
    Bot-->>Pat: عرض الأيام المتاحة كأزرار تفاعلية
    
    Pat->>Bot: اختيار اليوم
    Bot-->>Pat: عرض الساعات المتاحة في ذلك اليوم
    
    Pat->>Bot: اختيار الساعة (مثال: الأربعاء 10:00 صباحاً)
    Bot->>DB: حجز الموعد مؤقتاً (وضع القفل في Redis)
    
    Bot->>DB: التحقق من نوع الزيارة والتأمين الطبي
    alt الزيارة متابعة مجانية (Follow-up)
        DB->>DB: التحقق من وجود كشف سابق مؤكد خلال 14 يوم
        alt كشف سابق صالح وموجود
            Bot-->>Pat: "تم تأكيد موعد الاستشارة/المتابعة المجانية بنجاح! كود الحجز: BK-XXXX"
        else لا يوجد كشف سابق صالح
            Bot-->>Pat: "عذراً، لا يوجد كشف سابق صالح للاستشارة المجانية. سيتم تحويل حجزك ككشف جديد."
            Note over Bot, Pat: الانتقال لخطوات الدفع أدناه
        end
    else الزيارة كشف جديد (New Exam)
        alt المريض لديه تأمين طبي (Medical Insurance)
            Bot-->>Pat: "يرجى اختيار شركة التأمين الخاصة بك من القائمة وإرسال صورة واضحة لكارت التأمين"
            Pat->>Bot: إرسال صورة كارت التأمين
            Bot->>DB: حفظ طلب حجز التأمين أوفلاين بانتظار موافقة السكرتير يدوياً
            Bot-->>Pat: "تم استلام طلب الحجز بالتأمين الطبي وجارٍ المراجعة من السكرتارية. سنرسل لك رسالة بالتأكيد فوراً."
        else دفع كاش بالعيادة (Pay at Clinic)
            Bot->>DB: تحديث الحجز كحالة 'مؤكد - دفع بالعيادة'
            Bot-->>Pat: "تم تأكيد حجزك بنجاح! كود الحجز: BK-XXXX. يرجى الدفع في الاستقبال عند الحضور."
        else دفع أونلاين (Online Payment)
            Bot->>Pay: توليد فاتورة ورابط دفع إلكتروني (Payment Intent)
            activate Pay
            Pay-->>Bot: رابط الدفع الإلكتروني المخصص
            deactivate Pay
            Bot-->>Pat: "تم حجز الموعد مؤقتاً. سعر الكشف 500 جنيه. ادفع الآن خلال المهلة المحددة عبر هذا الرابط للحصول على خصم 10%: [رابط الدفع]"
        end
    end
```

### 5.3 رحلة انتهاء المهلة وإلغاء الحجز المتروك (Payment Timeout Flow)

```mermaid
flowchart TD
    Start([بدء الحجز المؤقت وتوليد رابط الدفع T0]) --> StartTimer[بدء مؤقت تنازلي للمدة المحددة من الطبيب]
    
    StartTimer --> CheckPayment{هل وصلنا إشعار دفع ناجح Webhook؟}
    
    CheckPayment -- نعم (قبل انتهاء المهلة) --> ConfirmBooking[1. تحديث حالة الحجز إلى Confirmed]
    ConfirmBooking --> UpdateSlot[2. تحديث حالة الـ Slot إلى Booked]
    ConfirmBooking --> SendConfirmation[3. إرسال رسالة واتساب للمريض بتأكيد الحجز وكود الحجز BK-XXXX وموقع العيادة]
    
    CheckPayment -- لا --> TimerExpired{هل انتهت المهلة المحددة؟}
    
    TimerExpired -- نعم (ولم يتم الدفع) --> CancelBooking[1. تحديث حالة الحجز إلى Cancelled - Timeout]
    CancelBooking --> FreeSlot[2. تحرير الـ Slot وتحديث حالته إلى Available ليظهر للجميع]
    CancelBooking --> SendTimeoutMsg[3. إرسال رسالة واتساب للمريض: 'تم إلغاء حجزك المؤقت لعدم الدفع في الوقت المحدد. يمكنك المحاولة مجدداً']
    
    TimerExpired -- لا (الوقت مستمر) --> CheckPayment
```

---

## 6. القرارات المعتمدة لفض النزاعات والمهل (Approved Design Decisions)

> [!NOTE]
> بناءً على مراجعة متطلبات العمل والتشغيل، تم اعتماد القواعد التالية:

1. **فض تعارضات العمل أوفلاين**: عند حدوث تعارض (حجز نفس الساعة أونلاين وأوفلاين في نفس الوقت)، **لا يتم الإلغاء التلقائي**. بدلاً من ذلك، يعرض النظام الحجزين معاً في لوحة التحكم للسكرتير كـ "نزاع معلق"، ويقوم السكرتير بالتدخل اليدوي وحل التعارض وتعديل أحد المواعيد بالتنسيق مع المرضى.
2. **مدة مهلة الدفع**: مدة صلاحية رابط الدفع وقفل الـ Slot هي **قيمة ديناميكية يحددها الطبيب** في إعدادات عيادته (مثال: 10 دقائق، 15 دقيقة، 30 دقيقة) ويتم تخزينها في عمود `payment_timeout_minutes` بجدول `tenants`.


