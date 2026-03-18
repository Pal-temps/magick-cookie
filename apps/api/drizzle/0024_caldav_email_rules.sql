CREATE TABLE caldav_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(255) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password_enc TEXT NOT NULL,
  calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  condition_field VARCHAR(50) NOT NULL,
  condition_operator VARCHAR(20) NOT NULL,
  condition_value VARCHAR(500) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_value VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
