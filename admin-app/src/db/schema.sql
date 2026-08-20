-- ==========================================
-- Smart Clinic OS (SCS) Database Schema
-- Version: 1.0
-- Description: Core tables for Tenant isolation, Admin & Clinic Users, and Roles
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
        }
    }'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for tenant lookup
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

-- 5. Platform Admin Sessions (جلسات التحقق الثنائي للأدمن)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    temp_token VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    otp_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Support Tickets Table (طلبات الدعم والترقية المرسلة من العيادات)
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

CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);

-- ==========================================
-- Seed Initial Data
-- Password for all seed users: "SecurePassword123!"
-- Hashed using bcrypt: $2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6
-- ==========================================

-- Insert Platform Admin
INSERT INTO admin_users (email, password_hash, full_name, role)
VALUES (
    'ops@SCS-ops.com',
    '$2a$10$FA.b3tjWz0KQKGNlm.RGxu7gGb9FJcFC4AW/LKpPpH8uUE1w2.Ye6',
    'أحمد مشغل النظام',
    'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert Mock Tenant (عيادة النور)
INSERT INTO tenants (id, name, slug, subscription_plan, expires_at)
VALUES (
    'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'عيادة النور لطب الأسنان',
    'dr-mohamed-noor',
    'pro',
    NOW() + INTERVAL '1 year'
) ON CONFLICT (slug) DO NOTHING;

-- Insert Mock Roles for the Tenant
INSERT INTO roles (id, tenant_id, name)
VALUES 
    ('b1111111-2222-3333-4444-555555555555', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'owner'),
    ('b2222222-2222-3333-4444-555555555555', 'a7b3c2d1-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'secretary')
ON CONFLICT DO NOTHING;

-- Insert Mock Users (Doctor and Secretary)
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
