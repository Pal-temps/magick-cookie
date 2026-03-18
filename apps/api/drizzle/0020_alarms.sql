CREATE TABLE alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time VARCHAR(5) NOT NULL,
  label VARCHAR(255) NOT NULL,
  repeat_pattern VARCHAR(20) NOT NULL DEFAULT 'once',
  repeat_days VARCHAR(20),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
