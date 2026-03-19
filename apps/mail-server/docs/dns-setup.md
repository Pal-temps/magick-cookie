# Configuration DNS pour le mail server

Remplacer `domaine.com` par votre domaine reel et `IP_PUBLIQUE` par l'IP de votre serveur.

## Records DNS requis

| Record | Type | Valeur |
|--------|------|--------|
| `mail.domaine.com` | A | `IP_PUBLIQUE` |
| `domaine.com` | MX | `10 mail.domaine.com` |
| `domaine.com` | TXT (SPF) | `v=spf1 mx -all` |
| `_dmarc.domaine.com` | TXT (DMARC) | `v=DMARC1; p=quarantine` |
| `mail._domainkey.domaine.com` | TXT (DKIM) | *(genere par `setup.sh`)* |

## rDNS (PTR)

Le reverse DNS doit etre configure aupres de votre FAI/hebergeur :

```
IP_PUBLIQUE → mail.domaine.com
```

## Verification

```bash
# Tester SPF
dig TXT domaine.com

# Tester DKIM
dig TXT mail._domainkey.domaine.com

# Tester DMARC
dig TXT _dmarc.domaine.com

# Tester MX
dig MX domaine.com

# Tester la delivrabilite
# Envoyer un email a check-auth@verifier.port25.com
```

## Notes

- Sans rDNS correct, la plupart des serveurs mail rejetteront vos emails
- Gmail/Outlook sont stricts sur SPF + DKIM + DMARC
- Le DKIM est genere automatiquement par `bun run mail:setup` (cle dans `config/opendkim/`)
