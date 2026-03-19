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
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
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
  sentAt: string;
  createdAt: string;
}

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface CreateEmailAccountDTO {
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

export interface SendEmailDTO {
  accountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}
