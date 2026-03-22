-- FinMind AI — PostgreSQL Database Schema
-- Run this in Supabase SQL Editor

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    name           TEXT,
    monthly_income NUMERIC(12,2) DEFAULT 0,
    risk_tolerance TEXT DEFAULT 'moderate',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    description TEXT,
    merchant    TEXT,
    category    TEXT,
    type        TEXT DEFAULT 'debit',
    source      TEXT DEFAULT 'manual',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, date DESC);

-- 3. Goals
CREATE TABLE IF NOT EXISTS goals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    target_amount  NUMERIC(12,2),
    current_amount NUMERIC(12,2) DEFAULT 0,
    deadline_years NUMERIC(4,1),
    priority       TEXT DEFAULT 'medium',
    probability    NUMERIC(5,2),
    status         TEXT DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Financial Plans (Agent Memory)
CREATE TABLE IF NOT EXISTS financial_plans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
    health_score     NUMERIC(5,2),
    plan_json        JSONB,
    conflict_resolved TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Loans
CREATE TABLE IF NOT EXISTS loans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    loan_type   TEXT,
    outstanding NUMERIC(12,2),
    annual_rate NUMERIC(5,2),
    monthly_emi NUMERIC(10,2),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
