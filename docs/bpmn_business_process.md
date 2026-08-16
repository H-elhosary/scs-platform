# 📊 مخطط عمليات البيزنس (BPMN 2.0 Business Process Diagram)
**الإصدار:** 1.0  
**التاريخ:** 2026-07-01  

---

## 1. مقدمة (Introduction)

يوثق هذا المستند **مخطط نمذجة عمليات الأعمال (BPMN 2.0)** بالتفصيل لمنصة عيادتي الذكية (Smart Clinic OS). يوضح المخطط كيفية تداخل الأدوار المختلفة (المريض، البوت، السكرتير، الطبيب، وبوابة الدفع) والرسائل المتبادلة بين الحارات (Lanes) المختلفة عبر دورة حياة المريض الكاملة من الحجز وحتى الخروج والروشتة.

---

## 2. مخطط BPMN التفاعلي (BPMN Mermaid Diagram)

```mermaid
%% BPMN 2.0 Process Diagram for Smart Clinic OS
graph TB
    %% Styling configurations
    classDef startEnd fill:#F1F5F9,stroke:#64748B,stroke-width:2px;
    classDef task fill:#E2E8F0,stroke:#475569,stroke-width:1.5px;
    classDef gateway fill:#FEF3C7,stroke:#D97706,stroke-width:1.5px;
    classDef external fill:#EEF2FF,stroke:#4F46E5,stroke-width:1.5px;
    
    %% Pools & Lanes representation
    subgraph Pool_Patient ["👤 Pool: Patient (المريض)"]
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

    subgraph Pool_Bot ["🤖 Pool: Multi-Channel Bot Engine (البوت الآلي: WhatsApp + Telegram)"]
        Bot_Triage[1. فحص الهاتف والفرز الطبي Triage]:::task
        Bot_Triage --> Bot_TriageGate{هل الحالة حرجة؟}:::gateway
        Bot_TriageGate -- نعم 🚨 --> Bot_Emergency[إرسال تحذير الطوارئ وإنهاء الجلسة]:::task
        Bot_TriageGate -- لا --> Bot_ShowSlots[عرض الـ Slots المتاحة لحظياً]:::task
        
        Bot_ShowSlots --> Bot_LockSlot[2. قفل الـ Slot مؤقتاً في Redis]:::task
        Bot_LockSlot --> Bot_GenInvoice[3. إنشاء فاتورة ورابط الدفع Paymob]:::task
        
        Bot_GenInvoice --> Bot_TimeoutTimer{بدء مؤقت إلغاء الحجز}:::gateway
        Bot_TimeoutTimer -- انتهى الوقت بدون سداد --> Bot_Cancel[4. إلغاء الحجز وتحرير الـ Slot وإرسال إشعار]:::task
        Bot_TimeoutTimer -- وصل إشعار سداد ناجح --> Bot_Confirm[5. تأكيد الموعد Confirmed وإرسال كود الحجز]:::task
    end

    subgraph Pool_Secretary ["👩‍💼 Pool: Clinic Desk / Secretary (السكرتاريا)"]
        Sec_CheckIn[1. تسجيل حضور المريض عند وصوله Checked-In]:::task
        Sec_CheckIn --> Sec_UpdateQueue[2. إدراج المريض في قائمة الانتظار العامة]:::task
        Sec_UpdateQueue --> Sec_WaitingTV[3. تحديث شاشة الـ TV عبر WebSockets]:::task
        Sec_WaitingTV -.-> Pat_Wait
        
        Sec_ManageConflicts[4. حل نزاعات حجز الأوفلاين يدوياً]:::task
        Sec_CashCollect[5. تحصيل كاش وتأكيد فواتير الخدمات الإضافية]:::task
    end

    subgraph Pool_Doctor ["👨‍⚕️ Pool: Doctor (الطبيب)"]
        Doc_NextBtn[1. الضغط على زر المريض التالي]:::task
        Doc_NextBtn --> Doc_Chime[2. إطلاق جرس التنبيه الصوتي بالشاشة العامة]:::task
        Doc_Chime -.-> Pat_Called
        
        Doc_NextBtn --> Doc_OpenFile[3. فتح السجل الطبي SOAP للمريض النشط]:::task
        Doc_OpenFile --> Doc_Diagnosis[4. تدوين الفحص والتشخيص ICD-11]:::task
        Doc_Diagnosis --> Doc_Prescription[5. كتابة الروشتة واعتمادها بالتوقيع الرقمي]:::task
        Doc_Prescription --> Doc_Save[6. إغلاق ملف الزيارة وحفظ السجل مشفر]:::task
        Doc_Save --> Doc_ExtraService{هل توجد خدمات إضافية؟}:::gateway
        Doc_ExtraService -- نعم --> Doc_AddInvoice[7. إصدار فاتورة إضافية وإرسالها للسكرتير]:::task
        Doc_ExtraService -- لا --> Doc_End((End)):::startEnd
        Doc_AddInvoice -.-> Sec_CashCollect
    end

    subgraph Pool_Payment ["💳 Pool: Payment Gateway (Paymob/Fawry)"]
        Pay_Process[معالجة عملية الدفع]:::task
        Pay_Process --> Pay_Webhook[إرسال Webhook بالدفع الناجح]:::task
    end

    %% Message and Sequence flows linking pools (BPMN Message Flows)
    Pat_Msg -.-> |رسالة واتساب| Bot_Triage
    Bot_ShowSlots -.-> |عرض الأيام والساعات| Pat_ChooseSlot
    Pat_PayOnline -.-> |بيانات الكارت/المحفظة| Pay_Process
    Pay_Webhook -.-> |إشعار الدفع الناجح| Bot_Confirm
    Bot_Confirm -.-> |رسالة التأكيد وكود الحجز| Pat_ReceiveConf
    
    Pat_Arrive -.-> Sec_CheckIn
    Doc_Prescription -.-> |توليد الروشتة وإرسالها آلياً| Pat_ReceiveRx
    
    %% Styling Class applications
    class Pat_Start,Pat_End,Doc_End startEnd;
    class Bot_TriageGate,Bot_TimeoutTimer,Bot_TriageGate,Bot_TriageGate,Doc_ExtraService,Pat_PaySelect gateway;
    class Pay_Process,Pay_Webhook external;
```

---

## 3. شرح عناصر العمليات وتدفق الرسائل (BPMN Elements & Message Flows)

### 3.1 الأحداث (Events)
- **حدث البداية (Start Event):** يتم إطلاقه عندما يرسل المريض رسالة نصية لأول مرة إلى رقم العيادة عبر الواتساب.
- **حدث النهاية (End Event):** ينتهي المسار عند استلام المريض لروشتة الـ PDF الموقعة رقمياً وخروجه من العيادة.

### 3.2 المهام الموزعة (Tasks Classification)
- **مهام مستخدم (User Tasks):** 
  - اختيار الموعد بالواتساب من المريض.
  - تسجيل حضور المريض وحل النزاعات من السكرتير.
  - فحص المريض وتدوين التشخيص من الطبيب.
- **مهام آليّة (Service Tasks):**
  - فحص الهاتف، الفرز الطبي (Triage)، توليد رابط الدفع، وإرسال الروشتة بالكامل عبر البوت (`Bot Engine`).
  - معالجة عمليات الدفع عبر البوابة الإلكترونية (`Paymob`).

### 3.3 البوابات القرارية (Gateways)
- **بوابة الفرز الطبي (Triage Exclusive Gateway):** تفصل بين تحويل المريض للحجز العادي أو توجيهه الفوري للطوارئ لإنقاذ حياته.
- **بوابة مهلة الدفع (Timeout Gateway):** تعمل كـ Event-based Gateway لمراقبة أي الحالتين ستحدث أولاً: استلام إشعار الدفع الناجح (Confirm) أم انتهاء العداد التنازلي للمهلة دون سداد (Cancel).
- **بوابة الخدمات الإضافية (Extra Services Gateway):** تقرر ما إذا كان الطبيب يحتاج لطلب سداد خدمات إجراءات تجميلية أو جراحية إضافية عبر السكرتير والمريض.

