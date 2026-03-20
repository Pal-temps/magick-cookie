# Plan : Envoi d'emails (SMTP)

## Contexte

La feature email gere actuellement la reception (IMAP) et la consultation. L'envoi n'est pas implemente, mais l'infrastructure est prete :
- **DB** : `smtpHost`, `smtpPort`, `smtpSecure` existent sur `email_accounts`
- **Dependance** : `nodemailer@^8.0.2` + `@types/nodemailer` deja installes
- **Frontend** : les presets SMTP (Gmail, Outlook, etc.) sont deja configures dans `AccountSettings.tsx`

## Architecture

```
Desktop (ComposeEmail) → API (POST /api/emails/send) → SmtpConnector (nodemailer) → SMTP serveur
                                                      → EmailRepository.create() (copie en DB, folder="Sent")
```

---

## Etape 1 — Backend : SmtpConnector

**Fichier** : `apps/api/src/infrastructure/connectors/smtp.connector.ts` (nouveau)

- `sendEmail(config, message)` → `{ messageId: string }`
  - `config` : `{ host, port, secure, username, password }`
  - `message` : `{ from, to: string[], cc?: string[], subject, text, html? }`
  - Utilise `nodemailer.createTransport()` avec TLS
  - Timeout de 15s comme l'IMAP connector
- `testConnection(config)` → `boolean`
  - `transporter.verify()` — tester que le SMTP repond

### Securite
- Valider les adresses email (regex basique ou `validator`)
- Limiter la taille du body (ex: 5MB)
- Rate limit cote route (ex: 20 emails/min par account)

---

## Etape 2 — Backend : EmailService + Route

### 2.1 Service

**Fichier** : `apps/api/src/application/email/email.service.ts`

- `sendEmail(accountId, message)` :
  1. Recuperer le compte + password dechiffre
  2. Appeler `smtpConnector.sendEmail()`
  3. Sauvegarder une copie en DB (`emailRepo.create()`) avec `folder: "Sent"`
  4. Retourner l'email cree

### 2.2 Route

**Fichier** : `apps/api/src/presentation/routes/email.routes.ts`

```
POST /api/emails/send
Body: { accountId, to: string[], cc?: string[], subject, bodyText, bodyHtml? }
Response: { data: Email }
```

### 2.3 Validateur

**Fichier** : `apps/api/src/presentation/validators/email.validator.ts`

- `sendEmailSchema` : zod schema pour le body (to requis, subject requis, au moins bodyText ou bodyHtml)

---

## Etape 3 — Frontend : Compose UI

### 3.1 Bouton "Composer"

**Fichier** : `apps/desktop/src/ui/components/email/EmailView.tsx`

- Ajouter un bouton "Nouveau" dans la toolbar (a cote de Sync, Digest, etc.)
- Ouvre le composant `ComposeEmail` en mode modal ou panneau lateral

### 3.2 Composant ComposeEmail

**Fichier** : `apps/desktop/src/ui/components/email/ComposeEmail.tsx` (nouveau)

- Formulaire : To, Cc (toggle), Subject, Body (textarea)
- Selecteur de compte (si plusieurs comptes)
- `from` auto-rempli depuis le compte selectionne
- Bouton "Envoyer" → appel API → fermer le formulaire
- Etat loading + gestion erreur

### 3.3 Reply / Forward (phase 2)

- Boutons "Repondre" et "Transferer" dans `EmailDetail.tsx`
- Pre-remplir le formulaire :
  - **Reply** : `to` = sender original, `subject` = "Re: ...", `body` = citation
  - **Forward** : `subject` = "Fwd: ...", `body` = email original

### 3.4 Store

**Fichier** : `apps/desktop/src/application/stores/emailStore.ts`

- `sendEmail(accountId, to, cc, subject, bodyText, bodyHtml?)` → appel `POST /api/emails/send`
- Pas de cache specifique pour l'envoi

---

## Etape 4 — Optionnel : Brouillons

Non prevu en v1. Si besoin :
- Ajouter `isDraft: boolean` au schema DB
- `POST /api/emails/draft` pour sauvegarder
- `PUT /api/emails/:id/draft` pour update
- Auto-save toutes les 30s dans le compose

---

## Fichiers modifies / crees

| Fichier | Action |
|---------|--------|
| `apps/api/src/infrastructure/connectors/smtp.connector.ts` | Nouveau |
| `apps/api/src/application/email/email.service.ts` | +`sendEmail()` |
| `apps/api/src/presentation/routes/email.routes.ts` | +`POST /api/emails/send` |
| `apps/api/src/presentation/validators/email.validator.ts` | +`sendEmailSchema` |
| `apps/desktop/src/ui/components/email/ComposeEmail.tsx` | Nouveau |
| `apps/desktop/src/ui/components/email/EmailView.tsx` | +bouton "Nouveau" |
| `apps/desktop/src/ui/components/email/EmailDetail.tsx` | +boutons Reply/Forward (phase 2) |
| `apps/desktop/src/application/stores/emailStore.ts` | +`sendEmail()` |

## Verification

1. **Envoi basique** : composer un email → envoyer → verifier reception sur Gmail
2. **Copie Sent** : l'email envoye apparait dans le folder "Sent" de l'app
3. **Multi-comptes** : envoyer depuis chaque compte configure
4. **Erreurs** : tester avec mauvais SMTP, timeout, adresse invalide
5. **Reply** (phase 2) : repondre a un email → verifier le threading
