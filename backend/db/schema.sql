-- ==========================================
-- Smart Clinic OS (SCS) Database Schema
-- Version: 2.0
-- Description: Complete schema for Tenants, Users, Patients, Appointments, Services, EMR & Settings
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table (عيادات النظام)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    subscription_plan VARCHAR(50) DEFAULT 'pro' CHECK (subscription_plan IN ('basic', 'pro', 'enterprise')),
    specialty VARCHAR(100) DEFAULT 'dental',
    allow_multi_doctor BOOLEAN DEFAULT TRUE,
    allow_insurance BOOLEAN DEFAULT FALSE,
    allow_refunds BOOLEAN DEFAULT FALSE,
    allow_whatsapp BOOLEAN DEFAULT TRUE,
    allow_telegram BOOLEAN DEFAULT FALSE,
    allow_analytics BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{
        "notification_settings": {
            "patient_email_booking_confirm": true,
            "patient_whatsapp_booking_confirm": true,
            "patient_email_prescription": true,
            "patient_email_invoice": true,
            "doctor_email_new_booking": true,
            "doctor_whatsapp_new_booking": false,
            "doctor_email_daily_report": true,
            "doctor_email_weekly_report": true
        },
        "operational_settings": {
            "cancellation_window_hours": 6,
            "payment_timeout_minutes": 15,
            "followup_grace_period_days": 14,
            "allow_bot_followups": true,
            "refund_destination": "wallet",
            "allow_priority_checkin": true
        },
        "prescription_settings": {
            "header_ar": "عيادة النور لطب الأسنان",
            "header_en": "Al-Nour Dental Clinic",
            "theme_color": "#1a73e8",
            "footer_text": "نتمنى لكم الشفاء العاجل",
            "logo_url": ""
        }
    }'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2. Roles Table (الأدوار)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- 3. Users Table (مستخدمي العيادات - أطباء وسكرتارية)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. Platform Admin Users Table (مشغلي المنصة)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Platform Admin Sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    temp_token VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    otp_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Doctors Table (الأطباء)
CREATE TABLE IF NOT EXISTS doctors (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    specialty VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Services Table (الخدمات والأسعار)
CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    duration_minutes INT DEFAULT 20,
    category VARCHAR(50) DEFAULT 'exam',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Patients Table (المرضى)
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    age INT,
    gender VARCHAR(20),
    email VARCHAR(255),
    blood_type VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,
    source VARCHAR(50) DEFAULT 'manual',
    tags TEXT[],
    total_visits INT DEFAULT 0,
    last_visit_at TIMESTAMP WITH TIME ZONE,
    total_paid NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Appointments Table (المواعيد)
CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES patients(id) ON DELETE SET NULL,
    doctor_id VARCHAR(100) REFERENCES doctors(id) ON DELETE SET NULL,
    service_id VARCHAR(100) REFERENCES services(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10),
    status VARCHAR(50) DEFAULT 'confirmed',
    visit_type VARCHAR(50) DEFAULT 'exam',
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_status VARCHAR(50) DEFAULT 'pending',
    amount NUMERIC(10, 2) DEFAULT 0.00,
    queue_number INT,
    notes TEXT,
    booking_code VARCHAR(50),
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Medical Records Table (السجلات الطبية الروشتات)
CREATE TABLE IF NOT EXISTS medical_records (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id VARCHAR(100) REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id VARCHAR(100) REFERENCES doctors(id) ON DELETE SET NULL,
    subjective TEXT,
    objective JSONB DEFAULT '{}'::jsonb,
    diagnosis_icd11 VARCHAR(255),
    plan TEXT,
    prescription_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Tickets Table (تذاكر الدعم)
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tenant_name VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    type_ar VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    response_notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Conversations Table (الإنبوكس والمحادثات)
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(100) REFERENCES patients(id) ON DELETE CASCADE,
    patient_name VARCHAR(255),
    channel VARCHAR(50) DEFAULT 'whatsapp',
    bot_active BOOLEAN DEFAULT TRUE,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unread_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Messages Table (رسائل المحادثات)
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(100) PRIMARY KEY,
    conversation_id VARCHAR(100) REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL,
    body TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SEED INITIAL DATA
-- ==========================================

-- Platform Admin
INSERT INTO admin_users (email, password_hash, full_name, role)
VALUES (
    'ops@SCS-ops.com',
    '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6',
    'أحمد مشغل النظام',
    'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- Mock Tenant (عيادة النور)
INSERT INTO tenants (id, name, slug, subscription_plan, expires_at)
VALUES (
    'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'عيادة النور لطب الأسنان',
    'dr-mohamed-noor',
    'pro',
    NOW() + INTERVAL '1 year'
) ON CONFLICT (slug) DO NOTHING;

-- Roles
INSERT INTO roles (id, tenant_id, name)
VALUES 
    ('b1111111-2222-3333-4444-555555555555', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'owner'),
    ('b2222222-2222-3333-4444-555555555555', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'secretary')
ON CONFLICT DO NOTHING;

-- Users (Doctor & Secretary)
INSERT INTO users (tenant_id, role_id, full_name, email, phone, password_hash)
VALUES 
    (
        'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 
        'b1111111-2222-3333-4444-555555555555', 
        'د. محمد نور', 
        'clinic_info@noor.com', 
        '+201012345678', 
        '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6'
    ),
    (
        'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 
        'b2222222-2222-3333-4444-555555555555', 
        'سارة أحمد', 
        'sara@noor.com', 
        '+201211112222', 
        '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6'
    )
ON CONFLICT DO NOTHING;

-- Doctors
INSERT INTO doctors (id, tenant_id, full_name, specialty)
VALUES 
    ('doc-1', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'د. محمد نور', 'أسنان عام'),
    ('doc-2', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'د. ليلى أحمد', 'تقويم أسنان')
ON CONFLICT DO NOTHING;

-- Services
INSERT INTO services (id, tenant_id, name, name_en, price, duration_minutes, category)
VALUES 
    ('svc-001', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'كشف عام', 'General Exam', 500, 20, 'exam'),
    ('svc-002', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'متابعة مجانية', 'Free Follow-up', 0, 15, 'followup'),
    ('svc-003', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'تنظيف أسنان', 'Teeth Cleaning', 800, 30, 'procedure'),
    ('svc-004', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'حشو عصب', 'Root Canal', 2500, 60, 'procedure'),
    ('svc-005', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'خلع ضرس', 'Tooth Extraction', 600, 30, 'procedure'),
    ('svc-006', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'تبييض أسنان', 'Teeth Whitening', 3000, 45, 'cosmetic')
ON CONFLICT DO NOTHING;

-- Patients
INSERT INTO patients (id, tenant_id, phone, full_name, first_name, last_name, age, gender, email, blood_type, source, tags, total_visits, total_paid)
VALUES 
    ('pat-001', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '+201098765432', 'أحمد محمد حسن', 'أحمد', 'حسن', 32, 'male', 'ahmed@example.com', 'A+', 'whatsapp_bot', ARRAY['VIP'], 5, 2500),
    ('pat-002', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '+201112223344', 'سارة علي إبراهيم', 'سارة', 'إبراهيم', 28, 'female', 'sara@example.com', 'B+', 'manual', ARRAY[]::TEXT[], 3, 1500),
    ('pat-003', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '+201055566677', 'محمود سعيد عبد الله', 'محمود', 'عبد الله', 45, 'male', NULL, 'O+', 'whatsapp_bot', ARRAY[]::TEXT[], 8, 4000)
ON CONFLICT DO NOTHING;
