-- SkillSwap MVP — Sprint 1 schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash TEXT          NOT NULL,
  pseudo        VARCHAR(50)   UNIQUE NOT NULL,
  bio           TEXT          DEFAULT '',
  birth_date    DATE          NOT NULL,
  photo_url     TEXT          DEFAULT NULL,
  credit_balance INTEGER      NOT NULL DEFAULT 2,
  exchange_count INTEGER      NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) DEFAULT NULL,
  cgu_accepted  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Refresh tokens (to support JWT rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
