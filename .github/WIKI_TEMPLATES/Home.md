# Magick Cookie — Wiki

> A well-intentioned IDE. Local-first, AI-powered, privacy-respecting.

---

## Navigation

### Features
| Feature | Statut / Status | Page wiki |
|---------|-----------------|-----------|
| Dashboard & Widgets | 🔄 En validation | [Feature-Dashboard](Feature-Dashboard) |
| Calendar | 🔄 En validation | [Feature-Calendar](Feature-Calendar) |
| Notes | 🔄 En validation | [Feature-Notes](Feature-Notes) |
| IDE / Cookia | 🔄 En validation | [Feature-IDE-Cookia](Feature-IDE-Cookia) |
| Flux (Smart Inbox) | 🔄 En validation | [Feature-Flux](Feature-Flux) |
| Email | 🔄 En validation | [Feature-Email](Feature-Email) |
| RSS | 🔄 En validation | [Feature-RSS](Feature-RSS) |
| CI/CD | 🔄 En validation | [Feature-CICD](Feature-CICD) |
| Passwords (Vault) | 🔄 En validation | [Feature-Passwords](Feature-Passwords) |
| VPS Monitoring | 🔄 En validation | [Feature-VPS](Feature-VPS) |
| Browser | 🔄 En validation | [Feature-Browser](Feature-Browser) |
| Tools | 🔄 En validation | [Feature-Tools](Feature-Tools) |
| Settings | 🔄 En validation | [Feature-Settings](Feature-Settings) |
| Onboarding / First-Run | 🔄 En validation | [Feature-Onboarding](Feature-Onboarding) |
| Raccourcis & Command Palette | 🔄 En validation | [Feature-Shortcuts](Feature-Shortcuts) |
| Thème, i18n & Notifications | 🔄 En validation | [Feature-Theme-i18n](Feature-Theme-i18n) |
| Quick Capture & Focus Mode | 🔄 En validation | [Feature-Quick-Capture](Feature-Quick-Capture) |
| Desktop Mode | 🔄 En validation | [Feature-Desktop-Mode](Feature-Desktop-Mode) |
| DevOps CLI | 🔄 En validation | [Feature-DevOps-CLI](Feature-DevOps-CLI) |

Statuts : ✅ Validée | 🔄 En validation | ❌ Bloquée

---

### Architecture
- [Architecture-Overview](Architecture-Overview) — Vue d'ensemble du système
- [Architecture-Desktop](Architecture-Desktop) — Tauri + SolidJS frontend
- [Architecture-API](Architecture-API) — Bun + Hono + Drizzle backend
- [Architecture-Vault](Architecture-Vault) — KDBX vault & secrets

### Runbooks
- [Runbook-Release](Runbook-Release) — Publier une nouvelle version
- [Runbook-Database](Runbook-Database) — Migrations SQLite
- [Runbook-DevOps-CLI](Runbook-DevOps-CLI) — Ajouter un nouveau CLI DevOps

---

## Stack technique / Tech stack

| Couche | Technologie |
|--------|-------------|
| Desktop UI | SolidJS + TypeScript |
| Desktop Shell | Tauri v2 (Rust) |
| Backend API | Bun + Hono |
| Database | SQLite via Drizzle ORM |
| Secrets | KDBX vault (KeePass) |
| Installer | NSIS (Windows) |
| Tests | bun test (1300+ tests) |

---

## Liens utiles / Useful links

- [Issues v1.0.0](https://github.com/Pal-temps/magick-cookie/milestone/1)
- [GitHub Project board](https://github.com/orgs/Pal-temps/projects/1)
- [CHANGELOG](https://github.com/Pal-temps/magick-cookie/blob/main/CHANGELOG.md)
- [CONTRIBUTING](https://github.com/Pal-temps/magick-cookie/blob/main/CONTRIBUTING.md)
- [SECURITY](https://github.com/Pal-temps/magick-cookie/blob/main/SECURITY.md)

---

## Templates

Pour créer une nouvelle page wiki, utilise les templates dans [`.github/WIKI_TEMPLATES/`](https://github.com/Pal-temps/magick-cookie/tree/main/.github/WIKI_TEMPLATES) :
- `feature-validation.md` — page de validation d'une feature
- `architecture.md` — documentation d'architecture
- `runbook.md` — runbook opérationnel
