# Mise en production du mail server — paltemps.fr

## Etat actuel

- [x] Container docker-mailserver fonctionnel (dev local)
- [x] Certificats SSL self-signed generes
- [x] Boite mail `me@paltemps.fr` creee
- [x] SMTP (port 1587) et IMAP (port 1993) operationnels
- [x] Cle DKIM generee (dans `config/opendkim/keys/paltemps.fr/`)
- [x] Preset "Self-hosted" dans l'app desktop pointe vers `mail.paltemps.fr`

---

## Ce qui reste a faire

### 1. Enregistrements DNS

Ajouter ces records dans le panneau DNS de `paltemps.fr` (OVH, Cloudflare, etc.) :

| Type | Nom | Valeur | Obligatoire |
|------|-----|--------|-------------|
| **A** | `mail.paltemps.fr` | `<IP_DU_VPS>` | Oui |
| **MX** | `paltemps.fr` | `10 mail.paltemps.fr` | Oui (reception) |
| **TXT** (SPF) | `paltemps.fr` | `v=spf1 a:mail.paltemps.fr ~all` | Oui (anti-spam) |
| **TXT** (DMARC) | `_dmarc.paltemps.fr` | `v=DMARC1; p=quarantine; rua=mailto:me@paltemps.fr` | Oui (anti-spoofing) |
| **TXT** (DKIM) | `mail._domainkey.paltemps.fr` | *(voir section DKIM ci-dessous)* | Oui (signature) |

#### Valeur DKIM a copier dans le DNS

```
v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArS3JsxPchfTt3d/SNBjOipmQ1mWgDWdNvGvT6MnxjLC8Q+0t+cMHKEpJXSQ3d3Z6BtmFpoJa9rl/XJaLP/4tnn6ApG3wO3xQqSrIcOdMwB/fy41zC4H0q/SLbHykR43sr9WxV32jZiIjmiYcj5cY7ArPD3hDlN8CjyVgYyb6KNrDmm1gjmGkdXxwDeb3BiIUBzLINEZn8THOozA5m+ZIJK9CHCAnn3blDvyOj8/nUF6kgJIhHhuSzr28bly+3AXIlo7R77di7dfMXd1d7XYrvgxp1ouvioeZoiPZlOtjMzl0XB4MAofBmCnvqD9l/83yNBfHEmwVpj4T/rHkTPbopQIDAQAB
```

> Cette cle est dans `config/opendkim/keys/paltemps.fr/mail.txt`. Si tu regeneres les cles DKIM, il faudra mettre a jour le DNS aussi.

### 2. Reverse DNS (PTR)

A configurer chez l'hebergeur du VPS (pas dans le panneau DNS du domaine) :

```
<IP_DU_VPS> → mail.paltemps.fr
```

> Sans rDNS, Gmail/Outlook rejettent les mails. C'est souvent dans le panneau admin du VPS (OVH, Hetzner, etc.).

### 3. Deployer sur le VPS

```bash
# 1. Copier les fichiers sur le VPS
scp -r apps/mail-server/ user@VPS:~/mail-server/

# 2. Sur le VPS, obtenir un certificat Let's Encrypt
certbot certonly --standalone -d mail.paltemps.fr

# 3. Lancer avec la config production
cd ~/mail-server
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Creer la boite mail
docker exec magick-cookie-mail setup email add me@paltemps.fr <MOT_DE_PASSE>
```

Le `docker-compose.prod.yml` override :
- **SSL** : Let's Encrypt au lieu de self-signed
- **Ports** : standards (25, 143, 587, 993)
- **Securite** : SpamAssassin, ClamAV, Fail2ban, Postgrey actives

### 4. Mettre a jour le preset dans l'app

Une fois en prod, le preset "Self-hosted" dans `AccountSettings.tsx` doit pointer vers les ports standards :

```
imapHost: "mail.paltemps.fr", imapPort: 993
smtpHost: "mail.paltemps.fr", smtpPort: 587
smtpSecure: false (STARTTLS)
selfSigned: false (Let's Encrypt = cert valide)
```

### 5. Firewall du VPS

Ouvrir ces ports :

| Port | Protocole | Description |
|------|-----------|-------------|
| 25 | TCP | SMTP (reception entre serveurs) |
| 587 | TCP | Submission (envoi client → serveur) |
| 993 | TCP | IMAPS |
| 143 | TCP | IMAP STARTTLS (optionnel) |

---

## Verification

Une fois tout configure, tester avec :

```bash
# Verifier les records DNS
dig A mail.paltemps.fr
dig MX paltemps.fr
dig TXT paltemps.fr                    # SPF
dig TXT _dmarc.paltemps.fr            # DMARC
dig TXT mail._domainkey.paltemps.fr   # DKIM

# Tester la delivrabilite (envoyer un mail a cette adresse)
# → check-auth@verifier.port25.com
# Tu recevras un rapport detaille par retour

# Tester le score spam
# → https://www.mail-tester.com (envoyer un mail a l'adresse generee)
```

## Rappel : pourquoi chaque record

| Record | Role | Sans lui |
|--------|------|----------|
| **MX** | Dit ou arrivent les mails pour `@paltemps.fr` | Impossible de recevoir |
| **SPF** | Liste les serveurs autorises a envoyer pour `@paltemps.fr` | Mails en spam / spoofing possible |
| **DKIM** | Signature cryptographique des mails sortants | Mails en spam / integrite non verifiable |
| **DMARC** | Politique si SPF/DKIM echouent (quarantine/reject) | Pas de protection anti-spoofing |
| **rDNS** | L'IP pointe vers `mail.paltemps.fr` | Gmail/Outlook rejettent |
