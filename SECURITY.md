# Security Policy / Politique de sécurité

> [🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

---

## 🇫🇷 Français

### Versions supportées

| Version | Support sécurité |
|---------|-----------------|
| `main` (latest) | ✅ Supportée |
| Versions antérieures | ❌ Non supportées |

### Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique pour un problème de sécurité.**

Envoie un rapport privé via l'une de ces méthodes :

- **GitHub** : [Security Advisories](https://github.com/Pal-temps/magick-cookie/security/advisories/new) (recommandé)
- **Email** : contact@paltemps.fr — objet `[SECURITY] magick-cookie`

Inclure dans le rapport :
- Description de la vulnérabilité
- Étapes pour reproduire
- Impact potentiel
- Correctif suggéré si possible

### Délais de réponse

| Étape | Délai |
|-------|-------|
| Accusé de réception | 48h |
| Évaluation initiale | 7 jours |
| Correctif ou plan d'action | 30 jours |

Nous te notifierons à chaque étape et créditerons ta découverte dans le changelog (sauf si tu préfères rester anonyme).

### Périmètre

Sont dans le périmètre :
- Injection de code / commandes (RCE)
- Fuite de données sensibles (secrets KDBX, tokens)
- Contournement d'authentification
- XSS / CSRF sur l'interface

Hors périmètre :
- Attaques nécessitant un accès physique à la machine
- Vulnérabilités dans les dépendances tierces (signaler directement aux mainteneurs)

---

## 🇬🇧 English

### Supported versions

| Version | Security support |
|---------|-----------------|
| `main` (latest) | ✅ Supported |
| Previous versions | ❌ Not supported |

### Reporting a vulnerability

**Do not open a public issue for a security problem.**

Send a private report via one of these methods:

- **GitHub**: [Security Advisories](https://github.com/Pal-temps/magick-cookie/security/advisories/new) (recommended)
- **Email**: contact@paltemps.fr — subject `[SECURITY] magick-cookie`

Include in the report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix if possible

### Response timeline

| Step | Delay |
|------|-------|
| Acknowledgement | 48h |
| Initial assessment | 7 days |
| Fix or action plan | 30 days |

We will notify you at each step and credit your finding in the changelog (unless you prefer to remain anonymous).

### Scope

In scope:
- Code / command injection (RCE)
- Sensitive data leak (KDBX secrets, tokens)
- Authentication bypass
- XSS / CSRF on the interface

Out of scope:
- Attacks requiring physical access to the machine
- Vulnerabilities in third-party dependencies (report directly to their maintainers)
