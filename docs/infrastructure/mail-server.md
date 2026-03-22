# Mail Server (self-hosted)

Serveur mail self-hosted via [docker-mailserver](https://docker-mailserver.github.io/docker-mailserver/latest/) pour `paltemps.fr`.

## Services

| Service | Port local | Port prod | Description |
|---------|-----------|-----------|-------------|
| SMTP | 1025 | 25 | Envoi (MTA) |
| IMAP STARTTLS | 1143 | 143 | Reception (STARTTLS) |
| Submission | 1587 | 587 | Envoi client → serveur (STARTTLS) |
| IMAPS | 1993 | 993 | Reception (SSL) |

> Ports non-standard en local pour eviter les conflits (meme pattern que Proton Bridge).

## Demarrage rapide

```bash
# Setup complet (container + boite mail)
bun run mail:setup me@paltemps.fr changeme

# Ou manuellement :
bun run mail:up
docker exec magick-cookie-mail setup email add me@paltemps.fr changeme
```

## Commandes utiles

```bash
bun run mail:up                    # Demarrer
bun run mail:down                  # Arreter
docker exec magick-cookie-mail setup email add user@paltemps.fr password
docker exec magick-cookie-mail setup email list
docker logs magick-cookie-mail -f
docker exec magick-cookie-mail setup config dkim keysize 2048
```

## Integration avec Magick Cookie

1. Lancer le mail server : `bun run mail:up`
2. Dans l'app desktop > ajouter un compte avec le preset **Self-hosted**
3. Cocher **Certificat auto-signe** (en local)
4. Renseigner `me@paltemps.fr` / mot de passe

## Volumes

| Volume | Contenu |
|--------|---------|
| `mail-data` | Boites mail (Maildir) |
| `mail-state` | Etat interne (amavis, clamav, etc.) |
| `mail-logs` | Logs postfix/dovecot |

---

## Mise en production

### 1. Enregistrements DNS

| Type | Nom | Valeur |
|------|-----|--------|
| **A** | `mail.paltemps.fr` | `<IP_DU_VPS>` |
| **MX** | `paltemps.fr` | `10 mail.paltemps.fr` |
| **TXT** (SPF) | `paltemps.fr` | `v=spf1 a:mail.paltemps.fr ~all` |
| **TXT** (DMARC) | `_dmarc.paltemps.fr` | `v=DMARC1; p=quarantine; rua=mailto:me@paltemps.fr` |
| **TXT** (DKIM) | `mail._domainkey.paltemps.fr` | *(cle dans `config/opendkim/keys/paltemps.fr/mail.txt`)* |

### 2. Reverse DNS (PTR)

A configurer chez l'hebergeur VPS (pas dans le panneau DNS du domaine) :
```
<IP_DU_VPS> → mail.paltemps.fr
```
> Sans rDNS, Gmail/Outlook rejettent les mails.

### 3. Deployer sur le VPS

```bash
scp -r apps/mail-server/ user@VPS:~/mail-server/
# Sur le VPS :
certbot certonly --standalone -d mail.paltemps.fr
cd ~/mail-server
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker exec magick-cookie-mail setup email add me@paltemps.fr <MOT_DE_PASSE>
```

Le `docker-compose.prod.yml` active :
- **SSL** : Let's Encrypt
- **Ports** : standards (25, 143, 587, 993)
- **Securite** : SpamAssassin, ClamAV, Fail2ban, Postgrey

### 4. Mettre a jour le preset dans l'app

En prod, `AccountSettings.tsx` doit pointer vers les ports standards :
```
imapHost: "mail.paltemps.fr", imapPort: 993
smtpHost: "mail.paltemps.fr", smtpPort: 587
selfSigned: false (Let's Encrypt = cert valide)
```

### 5. Firewall VPS

| Port | Description |
|------|-------------|
| 25 | SMTP (reception entre serveurs) |
| 587 | Submission (envoi client → serveur) |
| 993 | IMAPS |
| 143 | IMAP STARTTLS (optionnel) |

### 6. Verification

```bash
dig A mail.paltemps.fr
dig MX paltemps.fr
dig TXT paltemps.fr                    # SPF
dig TXT _dmarc.paltemps.fr            # DMARC
dig TXT mail._domainkey.paltemps.fr   # DKIM
```

Tester la delivrabilite : envoyer un mail a `check-auth@verifier.port25.com` ou via [mail-tester.com](https://www.mail-tester.com).

### Rappel : role de chaque record

| Record | Sans lui |
|--------|----------|
| **MX** | Impossible de recevoir |
| **SPF** | Mails en spam / spoofing possible |
| **DKIM** | Mails en spam / integrite non verifiable |
| **DMARC** | Pas de protection anti-spoofing |
| **rDNS** | Gmail/Outlook rejettent |
