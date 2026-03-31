# Mail Server (self-hosted)

Serveur mail self-hosted via [docker-mailserver](https://docker-mailserver.github.io/docker-mailserver/latest/) pour `paltemps.fr`.

## Services

| Service | Port local | Port interne | Description |
|---------|-----------|--------------|-------------|
| SMTP | 1025 | 25 | Envoi (MTA) |
| IMAP STARTTLS | 1143 | 143 | Reception (STARTTLS) |
| Submission | 1587 | 587 | Envoi (client → serveur, STARTTLS) |
| IMAPS | 1993 | 993 | Reception (SSL) |

> Ports non-standard pour eviter les conflits en local (meme pattern que Proton Bridge).

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
# Demarrer / arreter
bun run mail:up
bun run mail:down

# Ajouter une boite mail
docker exec magick-cookie-mail setup email add user@paltemps.fr password

# Lister les comptes
docker exec magick-cookie-mail setup email list

# Logs
docker logs magick-cookie-mail -f

# Generer DKIM
docker exec magick-cookie-mail setup config dkim keysize 2048
```

## Volumes

| Volume | Contenu |
|--------|---------|
| `mail-data` | Boites mail (Maildir) |
| `mail-state` | Etat interne (amavis, clamav, etc.) |
| `mail-logs` | Logs postfix/dovecot |

## Integration avec magick-cookie

1. Lancer le mail server : `bun run mail:up`
2. Dans l'app desktop, ajouter un compte avec le preset **Self-hosted**
3. Cocher **Certificat auto-signe**
4. Renseigner `me@paltemps.fr` / mot de passe

## Production

Voir `docker-compose.prod.yml` pour la configuration production avec :
- Let's Encrypt (SSL)
- SpamAssassin + ClamAV + Fail2ban
- Ports standard (25, 143, 587, 993)

Voir `docs/dns-setup.md` pour la configuration DNS et la checklist de mise en production.
