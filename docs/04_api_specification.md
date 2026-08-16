# 📡 مستند مواصفات واجهات برمجة التطبيقات (API Specification)
**الإصدار:** 1.0  
**التاريخ:** 2026-07-01  
**المستند:** 4 من 9

---

## 1. المعايير العامة (General Standards)

### 1.1 خط الدخول الأساسي (Base URLs & Routing)

* **واجهات مشغل المنصة / الأوبريشن (Platform Operations):**
  - الفرونت إند `https://www.SCS-ops.com` يتصل بالباك إند على: `https://api.SCS-ops.com/v1` (مغلق تماماً ومحمي بـ VPN/IP Whitelisting).
* **واجهات العيادات والعملاء (Clinic Portals - Customers):**
  - الفرونت إند `https://www.SCS-admin.com/:clinic-slug` يتصل بالباك إند على: `https://api.SCS-admin.com/v1`
  - **تحديد هوية العيادة (Tenant Identification):**
    1. **الحالة الافتراضية (Path-based):** يرسل الفرونت إند ترويسة `X-Tenant-Slug: :clinic-slug` في كل طلب للـ API.
    2. **حالة النطاق المخصص (Custom/Subdomain):** يستخلص السيرفر الـ Tenant تلقائياً من الـ Host header (مثل: `dr-ahmed.SCS-admin.com` أو `clinic.drahmed.com`).
    3. تقوم الـ API Gateway بالتحقق من الـ Slug/Domain ومطابقته بقاعدة البيانات للحصول على الـ `tenant_id` وتمريره لطبقة الـ RLS.

### 1.2 الترويسات الافتراضية (Headers)
كل الطلبات يجب أن ترسل الترويسات التالية:
```http
Content-Type: application/json
Accept: application/json
X-Timezone: Africa/Cairo
```

للطلبات التي تتطلب صلاحيات (Authenticated):
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

للطلبات من الـ PWA أوفلاين/أونلاين (لتتبع المزامنة):
```http
X-Client-Timestamp: 2026-07-01T12:00:00Z
X-Offline-Id: UUID-v4-Generated-Locally
```

### 1.3 الاستجابات القياسية (Standard Responses)

**النجاح (Success 200/201):**
```json
{
  "success": true,
  "data": {}
}
```

**الفشل (Error 4xx/5xx):**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "رسالة شرح الخطأ للمستخدم العربي",
    "details": {}
  }
}
```

---

## 2. أكواد الأخطاء الشائعة (Standard Error Codes)

| كود الخطأ | الحالة (HTTP Status) | الوصف |
|-----------|---------------------|-------|
| `UNAUTHENTICATED` | 401 Unauthorized | الـ Token غير صالح أو انتهت صلاحيته |
| `FORBIDDEN_ACTION` | 403 Forbidden | المستخدم ليس لديه الصلاحية اللازمة للعملية |
| `VALIDATION_FAILED` | 400 Bad Request | البيانات المرسلة غير مطابقة للشروط المطلوبة |
| `RESOURCE_NOT_FOUND` | 404 Not Found | العنصر المطلوب غير موجود في قاعدة البيانات |
| `SLOT_LOCKED_OR_BOOKED` | 409 Conflict | الخانة الزمنية تم حجزها أو قفلها بواسطة مستخدم آخر |
| `OFFLINE_SYNC_CONFLICT` | 409 Conflict | تعارض أثناء مزامنة بيانات أوفلاين |
| `TENANT_SUSPENDED` | 403 Forbidden | حساب العيادة معطل أو انتهت فترة الاشتراك |
| `RATE_LIMIT_EXCEEDED` | 429 Too Many Requests | تم تجاوز عدد الطلبات المسموح بها |

---

## 3. واجهات مشغل النظام / صاحب السيستم (Platform Admin Endpoints)

---

### 3.1 تسجيل الدخول للأدمن (Admin Login)
- **الرابط:** `POST /admin/v1/auth/login`
- **الصلاحية:** عام (Public)
- **جسم الطلب (Request Body):**
```json
{
  "email": "ops@SCS-ops.com",
  "password": "SecurePassword123!"
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "requires_2fa": true,
    "two_factor_method": "whatsapp_otp",
    "temp_token": "temp_jwt_token_valid_for_5_min"
  }
}
```

---

### 3.2 التحقق الثنائي للأدمن (Admin 2FA Verification)
- **الرابط:** `POST /admin/v1/auth/verify-2fa`
- **الصلاحية:** عام (بـ Temp Token في الهيدر)
- **جسم الطلب (Request Body):**
```json
{
  "code": "123456"
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "admin_uuid",
      "email": "ops@SCS-ops.com",
      "full_name": "أحمد مشغل النظام",
      "role": "super_admin"
    },
    "access_token": "jwt_access_token",
    "refresh_token": "jwt_refresh_token_in_http_only_cookie"
  }
}
```

---

### 3.3 إنشاء عيادة جديدة وحساب الطبيب (Create Tenant & Doctor)
- **الرابط:** `POST /admin/v1/tenants`
- **الصلاحية:** `super_admin`, `admin`
- **جسم الطلب (Request Body):**
```json
{
  "tenant_name": "عيادة النور للتجميل",
  "specialty": "dermatology",
  "phone": "+201012345678",
  "email": "clinic_info@noor.com",
  "doctor_name": "د. محمد النور",
  "doctor_email": "dr.mohamed@noor.com",
  "doctor_phone": "+201098765432",
  "subscription_plan": "pro",
  "subscription_months": 12
}
```
- **استجابة النجاح (201 Created):**
```json
{
  "success": true,
  "data": {
    "tenant_id": "tenant_uuid",
    "doctor_id": "doctor_uuid",
    "activation_link": "https://www.SCS-admin.com/activate?token=activation_token_hash"
  }
}
```

---

### 3.4 عرض إحصائيات حالة التفعيل والعيادات (Tenant Analytics & Status)
- **الرابط:** `GET /admin/v1/tenants`
- **المعاملات (Query Params):** `page=1`, `limit=10`, `status=active|suspended`, `search=noor`
- **الصلاحية:** `super_admin`, `admin`, `support`
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "tenant_uuid",
        "name": "عيادة النور للتجميل",
        "specialty": "dermatology",
        "is_active": true,
        "subscription_plan": "pro",
        "subscription_expires_at": "2027-07-01T12:00:00Z",
        "usage_stats": {
          "total_patients": 1240,
          "total_appointments": 4530,
          "whatsapp_connection": "connected",
          "storage_used_mb": 420.5
        },
        "doctor": {
          "name": "د. محمد النور",
          "last_login_at": "2026-07-01T10:15:00Z"
        }
      }
    ],
    "pagination": {
      "total_records": 120,
      "total_pages": 12,
      "current_page": 1
    }
  }
}
```

---

## 4. واجهات العيادة والموظفين (Clinic Staff Endpoints)

---

### 4.1 إضافة حساب سكرتير جديد (Add Secretary Account)
- **الرابط:** `POST /v1/staff`
- **الصلاحية:** `doctor` (Owner)
- **جسم الطلب (Request Body):**
```json
{
  "full_name": "سارة أحمد",
  "email": "sara@noor.com",
  "phone": "+201211112222",
  "permissions": [
    "calendar:read",
    "calendar:write",
    "patients:read",
    "finance:cashier",
    "chat:read",
    "chat:write"
  ]
}
```
- **استجابة النجاح (201 Created):**
```json
{
  "success": true,
  "data": {
    "staff_id": "staff_uuid",
    "role": "secretary",
    "invitation_sent": true
  }
}
```

---

### 4.2 تعديل صلاحيات السكرتير (Update Secretary Permissions)
- **الرابط:** `PUT /v1/staff/:id/permissions`
- **الصلاحية:** `doctor` (Owner)
- **جسم الطلب (Request Body):**
```json
{
  "permissions": [
    "calendar:read",
    "calendar:write",
    "patients:read",
    "chat:read"
  ]
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "staff_id": "staff_uuid",
    "updated_permissions": ["calendar:read", "calendar:write", "patients:read", "chat:read"]
  }
}
```

---

### 4.3 تفعيل/تعطيل البوت يدوياً لمحادثة مريض (Toggle Chat Bot Manual Takeover)
- **الرابط:** `POST /v1/chats/:conversation_id/toggle-bot`
- **الصلاحية:** `doctor`, `secretary` (مع صلاحية `chat:bot_control`)
- **جسم الطلب (Request Body):**
```json
{
  "disable_bot": true,
  "duration_minutes": 60
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversation_id": "chat_uuid",
    "is_bot_active": false,
    "manual_mode_until": "2026-07-01T13:40:00Z"
  }
}
```

---

### 4.4 فحص المريض وكتابة الروشتة الذكية (Save Clinical SOAP & E-Prescription)
- **الرابط:** `POST /v1/appointments/:appointment_id/consultation`
- **الصلاحية:** `doctor` (مع صلاحية `patients:medical_write`)
- **جسم الطلب (Request Body):**
```json
{
  "subjective": "المريض يعاني من حب شباب شديد مع تهيج جلدي بالوجه منذ شهرين",
  "objective": {
    "blood_pressure": "120/80",
    "pulse": 75,
    "temperature": 37.0,
    "weight_kg": 68.0,
    "custom_derma_fields": {
      "skin_type": "oily",
      "acne_grade": "III"
    }
  },
  "assessment": "Acne Vulgaris severity grade III",
  "icd_codes": [
    { "code": "L70.0", "description": "Acne vulgaris" }
  ],
  "plan": "البدء بكورس تقشير ومضاد حيوي موضعي مع كريم ترطيب خالي من الزيوت",
  "prescription": {
    "items": [
      {
        "medication_id": "med_uuid_1",
        "medication_name": "Clindamycin Gel",
        "dosage": "طبقة رقيقة",
        "frequency": "مرتين يومياً",
        "duration": "14 يوم",
        "instructions": "مساءً وصباحاً بعد غسل الوجه"
      },
      {
        "medication_name": "Effaclar Duo Cream",
        "dosage": "مسحة بسيطة",
        "frequency": "مرة واحدة يومياً",
        "duration": "30 يوم",
        "instructions": "قبل النوم"
      }
    ],
    "notes_to_pharmacist": "الرجاء عدم استبدال الجيل باللوشن"
  }
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "medical_record_id": "record_uuid",
    "prescription_id": "prescription_uuid",
    "pdf_url": "https://storage.SCS-admin.com/tenant-id/prescriptions/rx-2026-0001.pdf",
    "whatsapp_status": "enqueued"
  }
}
```

---

### 4.5 مزامنة البيانات من الأوفلاين وحل النزاعات (Offline Bulk Sync)
- **الرابط:** `POST /v1/sync`
- **الصلاحية:** `doctor`, `secretary`
- **جسم الطلب (Request Body):**
يقوم الـ Client بإرسال مصفوفة من العمليات التي تمت محلياً بالترتيب الزمني:
```json
{
  "actions": [
    {
      "action_id": "local_action_uuid_1",
      "action_type": "appointment.create",
      "timestamp": "2026-07-01T12:05:00Z",
      "payload": {
        "patient_id": "patient_uuid",
        "doctor_id": "doctor_uuid",
        "service_id": "service_uuid",
        "time_slot_id": "slot_uuid_10_00",
        "payment_method": "cash",
        "status": "confirmed"
      }
    }
  ]
}
```
- **استجابة النجاح في حالة عدم وجود تعارض (200 OK):**
```json
{
  "success": true,
  "data": {
    "synced_count": 1,
    "conflicts": []
  }
}
```
- **استجابة الفشل الجزئي لوجود تعارض (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "OFFLINE_SYNC_CONFLICT",
    "message": "يوجد تعارض في البيانات التي تم تعديلها أثناء عدم الاتصال",
    "details": {
      "conflicts": [
        {
          "action_id": "local_action_uuid_1",
          "conflict_type": "double_booking",
          "resource_type": "appointment",
          "resource_id": "slot_uuid_10_00",
          "local_data": {
            "patient_name": "محمد أحمد (حجز محلي كاش أوفلاين)"
          },
          "server_data": {
            "patient_name": "سيد محمود (حجز أونلاين مدفوع عبر البوت)"
          },
          "conflict_record_id": "conflict_uuid"
        }
      ]
    }
  }
}
```

---

### 4.6 نداء المريض وتحديث شاشة الانتظار (Call Next Patient)
- **الرابط:** `POST /v1/queue/call-next`
- **الصلاحية:** `doctor`, `secretary` (مع صلاحية `waiting_room:manage`)
- **جسم الطلب (Request Body):**
```json
{
  "doctor_id": "doctor_uuid"
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "called_patient": {
      "queue_number": 14,
      "display_name": "محمد أ.",
      "appointment_id": "appointment_uuid"
    },
    "websocket_broadcast_sent": true
  }
}
```

---

### 4.7 إدارة إعدادات الإشعارات (Manage Notification Settings)

- **الرابط للحصول على الإعدادات:** `GET /v1/settings/notifications`
- **الرابط لتحديث الإعدادات:** `PUT /v1/settings/notifications`
- **الصلاحية:** `doctor` (Owner)

#### أ. الحصول على الإعدادات (GET Response):
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "notification_settings": {
      "patient_email_booking_confirm": true,
      "patient_whatsapp_booking_confirm": true,
      "patient_email_prescription": true,
      "patient_email_invoice": true,
      "doctor_email_new_booking": true,
      "doctor_whatsapp_new_booking": false,
      "doctor_email_daily_report": true,
      "doctor_email_weekly_report": true
    }
  }
}
```

#### ب. تحديث إعدادات الإشعارات (PUT Request & Response):
- **جسم الطلب (Request Body):**
```json
{
  "notification_settings": {
    "patient_email_booking_confirm": true,
    "patient_whatsapp_booking_confirm": false,
    "patient_email_prescription": true,
    "patient_email_invoice": true,
    "doctor_email_new_booking": true,
    "doctor_whatsapp_new_booking": false,
    "doctor_email_daily_report": true,
    "doctor_email_weekly_report": true
  }
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "تم تحديث إعدادات الإشعارات بنجاح",
    "updated_settings": {
      "patient_email_booking_confirm": true,
      "patient_whatsapp_booking_confirm": false,
      "patient_email_prescription": true,
      "patient_email_invoice": true,
      "doctor_email_new_booking": true,
      "doctor_whatsapp_new_booking": false,
      "doctor_email_daily_report": true,
      "doctor_email_weekly_report": true
    }
  }
}
```

---

## 5. واجهات ربط قنوات المحادثة (Multi-Channel Webhook Endpoints: WhatsApp + Telegram)

---

### 5.1 التحقق من رابط الـ Webhook الخاص بـ Meta (WhatsApp Webhook Verification)
- **الرابط:** `GET /webhooks/whatsapp`
- **المعاملات (Query Params):** `hub.mode=subscribe`, `hub.verify_token=my_secret_token`, `hub.challenge=12345678`
- **الصلاحية:** عام (يتم طلبه من سيرفرات Meta)
- **الاستجابة:** يجب إعادة قيمة `hub.challenge` كنص عادي (Plain text) بحالة 200 OK.

---

### 5.2 استقبال رسائل الواتساب من المرضى (WhatsApp Webhook Event Handler)
- **الرابط:** `POST /webhooks/whatsapp`
- **الصلاحية:** عام (مع فحص التوقيع `X-Hub-Signature-256` للتحقق من هوية المرسل Meta)
- **جسم الطلب (Request Body):**
تصل رسالة نصية أو حدث ضغط زر تفاعلي:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "whatsapp_business_id",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "16505553333",
              "phone_number_id": "whatsapp_phone_id"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Mahmoud Hassan"
                },
                "wa_id": "201012345678"
              }
            ],
            "messages": [
              {
                "from": "201012345678",
                "id": "wamid.HBgL...",
                "timestamp": "1782245600",
                "text": {
                  "body": "عايز أحجز كشف ليزر بكره"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "status": "received"
}
```
*(ملاحظة: السيرفر يعالج الرسالة فوراً في الـ Background Worker ويرد عبر استدعاء WhatsApp Outgoing API).*

---

### 5.3 إعداد Webhook لبوت التليجرام (Telegram Webhook Setup)
- **الإعداد:** يتم تسجيل الـ Webhook مرة واحدة عند تفعيل التليجرام للعيادة عبر Telegram API:
```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
Body: { "url": "https://api.SCS-admin.com/webhooks/telegram", "secret_token": "my_secret_token" }
```

---

### 5.4 استقبال رسائل التليجرام من المرضى (Telegram Webhook Event Handler)
- **الرابط:** `POST /webhooks/telegram`
- **الصلاحية:** عام (مع فحص `X-Telegram-Bot-Api-Secret-Token` header)
- **جسم الطلب (Request Body):**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1001,
    "from": {
      "id": 7654321,
      "first_name": "محمود",
      "last_name": "حسن",
      "username": "mahmoud_h"
    },
    "chat": {
      "id": 7654321,
      "type": "private"
    },
    "date": 1782245600,
    "text": "عايز أحجز كشف ليزر بكره"
  }
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "status": "received"
}
```
*(ملاحظة: نفس الـ State Machine الخاصة بالواتساب تُستخدم عبر Channel Adapter Pattern — الفرق فقط في طبقة النقل).*

> [!NOTE]
> **فرق مهم بين القناتين:**
> - **WhatsApp**: يحتاج Template Messages للرسائل خارج نافذة الـ 24 ساعة. تكلفة لكل رسالة.
> - **Telegram**: لا توجد نافذة 24 ساعة ولا رسوم على الرسائل. يدعم Inline Keyboards بدل Interactive Buttons.

---

## 6. واجهات بوابات الدفع الإلكتروني (Payment Gateway Webhooks)


---

### 6.1 إشعار تحديث حالة الدفع من Paymob (Paymob Transaction Webhook)
- **الرابط:** `POST /webhooks/payments/paymob`
- **الصلاحية:** عام (مع التحقق من الـ HMAC المرسل في الـ query params)
- **جسم الطلب (Request Body):**
```json
{
  "obj": {
    "id": 998877,
    "pending": false,
    "amount_cents": 45000,
    "success": true,
    "is_auth": false,
    "is_capture": false,
    "is_voided": false,
    "is_refunded": false,
    "currency": "EGP",
    "order": {
      "id": 11223344,
      "merchant_order_id": "invoice_uuid"
    },
    "payment_key_claims": {
      "extra": {
        "tenant_id": "tenant_uuid",
        "appointment_id": "appointment_uuid"
      }
    }
  }
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true
}
```
*(ملاحظة: السيرفر يقوم فوراً بتغيير حالة الفاتورة لـ Paid وحالة الحجز لـ Confirmed وإلغاء مؤقت الـ Timeout).*

