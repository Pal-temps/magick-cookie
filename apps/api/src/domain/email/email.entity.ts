export interface EmailAccount {
  id: string;
  label: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  selfSigned: boolean;
  lastSyncedAt: Date | null;
  syncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  accountId: string;
  messageId: string;
  imapUid: number | null;
  subject: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: EmailAddress[];
  ccAddresses: EmailAddress[];
  bodyText: string | null;
  bodyHtml: string | null;
  hasAttachments: boolean;
  attachmentNames: string[];
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  folder: string;
  summary: string | null;
  classification: string | null;
  sentAt: Date;
  createdAt: Date;
}

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface CreateEmailAccountInput {
  label: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password: string;
  selfSigned?: boolean;
}

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export interface UpdateEmailAccountInput {
  label?: string;
  syncEnabled?: boolean;
}

export interface CreateEmailInput {
  accountId: string;
  messageId: string;
  imapUid: number | null;
  subject: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: EmailAddress[];
  ccAddresses: EmailAddress[];
  bodyText: string | null;
  bodyHtml: string | null;
  hasAttachments: boolean;
  attachmentNames: string[];
  isRead: boolean;
  folder: string;
  sentAt: Date;
}
