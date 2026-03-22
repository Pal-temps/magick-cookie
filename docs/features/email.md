# Email

> Statut : **Done** — Reception IMAP, envoi SMTP, compose/reply/forward, digest IA, classification auto, raccourcis clavier.

Inbox unifiee multi-comptes avec lecture, envoi, et intelligence IA. Compatible IMAP/SMTP (Gmail, Outlook, Proton Bridge, self-hosted).

## Architecture

```
api/src/
├── domain/email/
│   ├── email.entity.ts              # EmailAccount, Email, EmailAddress
│   ├── email.repository.ts          # IEmailRepository
│   └── email-rule.entity.ts         # Regles auto-classification
├── application/email/
│   ├── email.service.ts             # Sync, fetch, send, mark read, delete
│   └── email-rule.service.ts        # Application des regles au sync
├── infrastructure/
│   ├── connectors/
│   │   ├── imap.connector.ts        # imapflow — reception
│   │   └── smtp.connector.ts        # nodemailer — envoi
│   ├── repositories/
│   │   ├── email-account.repository.impl.ts
│   │   └── email.repository.impl.ts
│   └── jobs/
│       └── email-sync.job.ts        # Poll IMAP toutes les 5 min

desktop/src/
├── application/stores/emailStore.ts
└── ui/components/email/
    ├── EmailView.tsx                # Vue principale
    ├── EmailList.tsx                # Liste (colonne gauche)
    ├── EmailDetail.tsx              # Contenu (colonne droite)
    ├── ComposeEmail.tsx             # Composition/reply/forward
    ├── EmailDigest.tsx              # Digest hebdo IA
    └── AccountSettings.tsx          # Gestion des comptes
```

## API

```
GET    /api/emails                          # Inbox unifiee (?accountId, ?folder, ?unread, ?limit, ?offset)
GET    /api/emails/:id                      # Email complet (body HTML/text)
PATCH  /api/emails/:id                      # { isRead, isStarred, isArchived }
DELETE /api/emails/:id                      # Supprimer (local + IMAP)
POST   /api/emails/send                     # Envoyer (SMTP + copie Sent)
POST   /api/emails/:id/summarize            # Resume IA

GET    /api/email-accounts                  # Lister les comptes
POST   /api/email-accounts                  # Ajouter un compte
PUT    /api/email-accounts/:id              # Modifier
DELETE /api/email-accounts/:id              # Supprimer (cascade)
POST   /api/email-accounts/:id/sync         # Forcer sync
POST   /api/email-accounts/test-connection  # Tester IMAP/SMTP
```

## Base de donnees

- `email_accounts` — comptes IMAP/SMTP (host, port, credentials chiffres)
- `emails` — messages (subject, from, to, body, flags, folder, summary, classification)
- `email_rules` — regles auto-classification (conditions JSON + action)

## Fonctionnalites

### Reception (IMAP)
- Sync incrementale par UID, deduplication par `message_id`
- Job de sync toutes les 5 minutes
- Suppression via IMAP MOVE to Trash
- Sync bidirectionnelle des flags (read, starred)

### Envoi (SMTP)
- nodemailer avec TLS
- Compose, reply (Re: + citation), forward (Fwd: + header)
- Copie automatique en DB folder "Sent"

### Intelligence IA
- **Resume** : bouton dans EmailDetail, prompt LLM, affichage bandeau
- **Classification auto** : newsletter, facture, action_requise, personnel, notification, autre
- **Digest hebdo** : resume IA des emails de la semaine
- Cache resume + classification en DB

### Raccourcis clavier (Gmail-style)
| Touche | Action |
|--------|--------|
| `j` / `k` | Email suivant / precedent |
| `Enter` | Ouvrir |
| `Escape` | Retour liste |
| `e` | Archiver |
| `s` | Star/unstar |
| `r` | Toggle lu/non lu |
| `Delete` | Supprimer |
| `c` | Nouveau mail |
| `g+i` / `g+s` | Aller a Inbox / Sent |

### Regles auto-classification
- Conditions : expediteur, sujet contient, domaine
- Actions : classifier, tagger, archiver
- Executees a chaque sync

## Configs fournisseurs

| Fournisseur | IMAP host | IMAP port | SMTP host | SMTP port |
|---|---|---|---|---|
| Gmail | imap.gmail.com | 993 | smtp.gmail.com | 587 |
| Outlook | outlook.office365.com | 993 | smtp.office365.com | 587 |
| Yahoo | imap.mail.yahoo.com | 993 | smtp.mail.yahoo.com | 465 |
| Proton (bridge) | 127.0.0.1 | 1143 | 127.0.0.1 | 1025 |
| Self-hosted | mail.paltemps.fr | 993 | mail.paltemps.fr | 587 |
