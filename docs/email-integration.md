# Plan d'intégration Email

## Objectif

Ajouter une vue **Inbox unifiée** dans l'app qui agrège plusieurs boîtes mail en une seule interface. Lecture, tri, actions basiques (lire, archiver, répondre). Compatible avec n'importe quel fournisseur supportant IMAP (Gmail, Outlook, Proton via bridge, hébergement perso, etc.).

---

## Stack technique retenue

| Besoin | Solution |
|---|---|
| Lecture emails | **imapflow** (IMAP moderne, async/await natif) |
| Parsing contenu | **mailparser** (parse MIME, HTML, pièces jointes) |
| Envoi | **nodemailer** (SMTP) |
| Auth OAuth Gmail | `googleapis` (optionnel, phase 3) |
| Auth OAuth Outlook | `@azure/msal-node` (optionnel, phase 3) |
| Stockage | PostgreSQL (tables `email_accounts` + `emails`) |
| Sync background | Job périodique (pattern existant `startReminderChecker`) |

---

## Architecture

Suit le pattern clean architecture existant.

```
api/src/
├── domain/email/
│   ├── email.entity.ts          # EmailAccount, Email, EmailFolder
│   └── email.repository.ts      # IEmailAccountRepository, IEmailRepository
├── application/email/
│   └── email.service.ts         # Sync, fetch, mark read, delete, reply
├── infrastructure/
│   ├── repositories/
│   │   ├── email-account.repository.impl.ts
│   │   └── email.repository.impl.ts
│   ├── connectors/
│   │   └── imap.connector.ts    # imapflow wrapper (connect, fetchNew, idle)
│   └── jobs/
│       └── email-sync.job.ts    # Poll IMAP toutes les X minutes
├── presentation/
│   ├── routes/email.routes.ts
│   └── validators/email.validator.ts

desktop/src/
├── domain/models/Email.ts
├── application/stores/emailStore.ts
└── ui/components/email/
    ├── EmailView.tsx             # Vue principale
    ├── EmailList.tsx             # Liste des emails (colonne gauche)
    ├── EmailDetail.tsx           # Contenu email (colonne droite)
    ├── EmailCompose.tsx          # Fenêtre de réponse/rédaction
    └── AccountSettings.tsx      # Ajout/gestion des comptes
```

---

## Base de données

### Migration `0007_email_accounts.sql`

```sql
-- Comptes email
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(255) NOT NULL,               -- "Perso", "Pro", etc.
  email VARCHAR(255) NOT NULL,
  -- IMAP
  imap_host VARCHAR(255) NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  -- SMTP
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  -- Auth (stocké chiffré en phase 2+)
  username VARCHAR(255) NOT NULL,
  password_enc TEXT NOT NULL,                -- chiffré avec clé locale
  -- Sync state
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(500) NOT NULL,          -- Message-ID header (déduplication)
  imap_uid INTEGER,                          -- UID IMAP pour sync incrémentale
  subject VARCHAR(1000),
  from_address VARCHAR(500) NOT NULL,
  from_name VARCHAR(255),
  to_addresses TEXT NOT NULL,                -- JSON array [{name, address}]
  cc_addresses TEXT,                         -- JSON array
  body_text TEXT,                            -- Texte brut
  body_html TEXT,                            -- HTML
  has_attachments BOOLEAN DEFAULT false,
  attachment_names TEXT,                     -- JSON array de noms de fichiers
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
```

---

## Entités domaine

```typescript
// email.entity.ts
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
  lastSyncedAt: Date | null;
  syncEnabled: boolean;
}

export interface Email {
  id: string;
  accountId: string;
  messageId: string;
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
  sentAt: Date;
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
  password: string; // chiffré avant stockage
}
```

---

## API Routes

```
GET    /api/emails                           # Inbox unifiée (tous comptes)
                                             # ?accountId=   filtre par compte
                                             # ?folder=      INBOX|Sent|Archive
                                             # ?unread=true  non lus seulement
                                             # ?limit=50&offset=0

GET    /api/emails/:id                       # Email complet (body HTML/text)
PATCH  /api/emails/:id                       # { isRead, isStarred, isArchived }
DELETE /api/emails/:id                       # Supprimer (local + IMAP)

POST   /api/emails/reply                     # Répondre
                                             # { emailId, body, cc? }
POST   /api/emails/compose                   # Nouveau mail
                                             # { accountId, to, subject, body, cc? }

GET    /api/email-accounts                   # Lister les comptes
POST   /api/email-accounts                   # Ajouter un compte
PUT    /api/email-accounts/:id               # Modifier
DELETE /api/email-accounts/:id               # Supprimer (cascade emails)
POST   /api/email-accounts/:id/sync          # Forcer sync immédiate
POST   /api/email-accounts/test-connection   # Tester IMAP/SMTP avant save
```

---

## Connecteur IMAP (`imap.connector.ts`)

```typescript
import { ImapFlow } from 'imapflow';

export class ImapConnector {
  async fetchNewEmails(account: EmailAccount, sinceUid?: number): Promise<RawEmail[]>
  async markRead(account: EmailAccount, uid: number): Promise<void>
  async deleteMessage(account: EmailAccount, uid: number): Promise<void>
  async testConnection(config: ImapConfig): Promise<boolean>
}
```

**Stratégie de sync :**
1. Connexion IMAP avec `imapflow`
2. `SELECT INBOX` (puis autres dossiers optionnels)
3. Fetch `UID SEARCH SINCE <lastSyncDate>` pour sync incrémentale
4. Parse avec `mailparser` → normaliser en `Email`
5. `INSERT ... ON CONFLICT DO NOTHING` (déduplication par `message_id`)
6. Déconnecter

---

## Job de synchronisation

Pattern identique à `startReminderChecker` :

```typescript
// email-sync.job.ts
export function startEmailSyncJob(emailService: EmailService) {
  const INTERVAL_MS = 5 * 60 * 1000; // toutes les 5 min

  async function run() {
    const accounts = await emailService.getActiveAccounts();
    await Promise.allSettled(accounts.map(acc => emailService.syncAccount(acc.id)));
  }

  run(); // sync immédiate au démarrage
  setInterval(run, INTERVAL_MS);
}
```

---

## Frontend — EmailStore

```typescript
// emailStore.ts
const [emails, setEmails] = createSignal<Email[]>([]);
const [accounts, setAccounts] = createSignal<EmailAccount[]>([]);
const [selectedEmail, setSelectedEmail] = createSignal<Email | null>(null);
const [activeAccount, setActiveAccount] = createSignal<string | null>(null); // null = tous
const [activeFolder, setActiveFolder] = createSignal("INBOX");
const [isLoading, setIsLoading] = createSignal(false);
const [unreadCount, setUnreadCount] = createSignal(0);
```

---

## Frontend — EmailView layout

```
┌─────────────────────────────────────────────────────────┐
│ [Inbox unifiée] [Compte 1] [Compte 2] ...    [+ Compte] │  ← onglets comptes
├──────────────────┬──────────────────────────────────────┤
│ INBOX  ●12       │  De: John <john@ex.com>              │
│ Envoyés          │  Objet: Re: Projet X                 │
│ Archive          │  Date: 15 mars 2026 - 10:42          │
│ ──────────────── │  ──────────────────────────────────  │
│ □ ● [John]       │  Corps de l'email                    │
│   Projet X       │  (HTML rendu ou texte)               │
│   15 mars        │                                      │
│                  │                                      │
│ □   [Marie]      │  ──────────────────────────────────  │
│   Re: RDV        │  [Répondre]  [Transférer]  [Archive] │
│   14 mars        │                                      │
└──────────────────┴──────────────────────────────────────┘
```

---

## Sécurité — stockage des mots de passe

**Phase 1 (MVP)** : Stockage en clair dans la DB locale (acceptable car DB locale non exposée).

**Phase 2** : Chiffrement avec clé dérivée d'un master password utilisateur via `node:crypto` (AES-256-GCM). La clé n'est jamais stockée, dérivée à l'ouverture de l'app.

**Phase 3 (optionnel)** : OAuth2 pour Gmail et Outlook (pas de mot de passe stocké). Nécessite setup d'une app OAuth dans Google Cloud Console / Azure.

---

## Phases de développement

### Phase 1 — MVP : Lecture IMAP + Inbox unifiée

**Durée estimée : 3-4 sessions**

- [ ] Migration DB (`email_accounts` + `emails`)
- [ ] Domaine : entités + interfaces repo
- [ ] `ImapConnector` avec `imapflow` + `mailparser`
- [ ] `EmailService` : `syncAccount()`, `getEmails()`, `getEmailById()`
- [ ] Repos Drizzle
- [ ] Routes API GET
- [ ] Job de sync toutes les 5 min
- [ ] Frontend : `emailStore`, `EmailView`, `EmailList`, `EmailDetail`
- [ ] Navigation : ajouter `"email"` à `ViewMode`
- [ ] Ajout dans le menu / sidebar

### Phase 2 — Gestion des comptes + Actions

- [ ] Route POST/PUT/DELETE `email-accounts`
- [ ] `AccountSettings.tsx` : formulaire d'ajout de compte (IMAP/SMTP config)
- [ ] Test de connexion avant sauvegarde
- [ ] Mark as read (API + IMAP)
- [ ] Archive (API + IMAP MOVE)
- [ ] Chiffrement des mots de passe

### Phase 3 — Rédaction / Réponse

- [ ] `nodemailer` pour l'envoi SMTP
- [ ] `EmailCompose.tsx` : éditeur simple (texte riche ou markdown)
- [ ] Répondre / Répondre à tous / Transférer
- [ ] Dossier "Envoyés"

### Phase 4 — Confort & Intégrations

- [ ] OAuth2 Gmail / Outlook (pas de mot de passe)
- [ ] IMAP IDLE (push temps réel à la place du polling)
- [ ] Pièces jointes (téléchargement + prévisualisation)
- [ ] Intégration triage : créer une tâche depuis un email
- [ ] Intégration calendrier : créer un événement depuis un email
- [ ] Badge de notification d'emails non lus dans la sidebar

---

## Configs IMAP/SMTP des fournisseurs courants

| Fournisseur | IMAP host | IMAP port | SMTP host | SMTP port |
|---|---|---|---|---|
| Gmail | imap.gmail.com | 993 | smtp.gmail.com | 587 |
| Outlook/Hotmail | outlook.office365.com | 993 | smtp.office365.com | 587 |
| Yahoo | imap.mail.yahoo.com | 993 | smtp.mail.yahoo.com | 465 |
| Proton (bridge) | 127.0.0.1 | 1143 | 127.0.0.1 | 1025 |
| OVH | imap.mail.ovh.net | 993 | ssl0.ovh.net | 465 |

> **Gmail** : nécessite un "App Password" si 2FA activé, ou OAuth2.

---

## Dépendances à ajouter

```bash
cd apps/api
bun add imapflow mailparser nodemailer
bun add -d @types/nodemailer
```

---

## Questions ouvertes

1. **Pagination** : charger 50 emails à la fois ou tout en local ? → recommandé : 50 en DB + scroll infini
2. **Corps HTML** : rendre le HTML dans un `<iframe sandbox>` pour isoler les styles/scripts malveillants
3. **Volume** : limiter le sync à N derniers jours (ex: 30 jours) pour ne pas remplir la DB
4. **Dossiers** : sync INBOX seulement en phase 1, tous les dossiers en phase 4
5. **Recherche** : recherche full-text PostgreSQL (`tsvector`) en phase 4
