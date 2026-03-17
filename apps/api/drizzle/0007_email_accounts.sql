-- Comptes email
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  imap_host VARCHAR(255) NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  username VARCHAR(255) NOT NULL,
  password_enc TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(500) NOT NULL,
  imap_uid INTEGER,
  subject VARCHAR(1000),
  from_address VARCHAR(500) NOT NULL,
  from_name VARCHAR(255),
  to_addresses TEXT NOT NULL DEFAULT '[]',
  cc_addresses TEXT,
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachment_names TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  folder VARCHAR(255) NOT NULL DEFAULT 'INBOX',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(account_id, message_id)
);

CREATE INDEX idx_emails_account_folder ON emails(account_id, folder, sent_at DESC);
CREATE INDEX idx_emails_unread ON emails(account_id, is_read) WHERE is_read = false;
