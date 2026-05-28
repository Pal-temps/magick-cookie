<div align="center">

# 🍪 Magick Cookie

**FR** · L'IDE intelligent pour piloter vos projets sans être développeur  
**EN** · The intelligent IDE to manage your projects without being a developer

[![CI](https://github.com/Pal-temps/magick-cookie/actions/workflows/ci.yml/badge.svg)](https://github.com/Pal-temps/magick-cookie/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Pal-temps/magick-cookie/actions/workflows/codeql.yml/badge.svg)](https://github.com/Pal-temps/magick-cookie/actions/workflows/codeql.yml)
[![License: PolyForm NC](https://img.shields.io/badge/license-PolyForm%20NC-blue)](LICENSE)

</div>

---

> [🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

---

## 🇫🇷 Français

### Qu'est-ce que c'est ?

Magick Cookie est un environnement de travail local-first piloté par l'IA. Il est conçu pour les entrepreneurs, indépendants et créateurs qui veulent gérer leurs projets efficacement sans maîtriser les outils de développement traditionnels.

L'application repose sur **quatre piliers** :

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   📁 Fichiers .md       🔐 Vault KDBX           │
│   Toutes vos données    Vos secrets chiffrés    │
│   en texte lisible      (clés API, tokens...)   │
│           ↕                     ↕               │
│   ⚙️  Settings          🤖 Cookia (IA)           │
│   Configuration         Votre assistant         │
│   de l'environnement    qui pilote tout ça      │
│                                                 │
└─────────────────────────────────────────────────┘
```

- **Fichiers Markdown** — vos notes, configs et données restent dans des fichiers `.md` lisibles, portables, synchronisables via Git
- **Vault KDBX** — vos secrets (clés API, tokens) sont chiffrés localement au format KeePass, jamais envoyés sur un serveur
- **Settings** — configurez une fois vos outils (LLM, Git, calendrier...) et Cookia s'en charge
- **Cookia** — votre IA qui lit votre contexte (.md, vault, projets) et vous aide à avancer

### Ce que vous pouvez faire

| Module | Fonctionnalités |
|--------|----------------|
| 🤖 **IDE / Cookia** | Chat IA multi-sessions, terminal, génération de code, diff |
| 📅 **Calendrier** | Événements, sync CalDAV, rappels intelligents |
| 📝 **Notes** | Markdown, Excalidraw, backlinks, sync Git |
| 📥 **Flux** | Inbox unifiée (tâches, emails, articles) en Kanban/Swipe |
| 📧 **Email** | Client multi-comptes IMAP/SMTP |
| 📡 **RSS** | Lecteur + digest IA |
| 🔐 **Passwords** | Gestionnaire de secrets KDBX |
| 🚀 **CI/CD** | GitHub Actions, GitLab, pipelines, PRs |
| 🖥️ **VPS** | Monitoring temps réel, logs SSE |
| 🌐 **Browser** | Navigateur intégré avec bookmarks |
| 🛠️ **Tools** | Vérificateur d'env, générateur de changelog |

### Local-first & vie privée

- **Aucune télémétrie** — vos données ne quittent jamais votre machine par défaut
- **Offline-ready** — fonctionne sans connexion, synchronise quand disponible
- **Vous gardez le contrôle** — tout est dans des fichiers que vous pouvez lire, sauvegarder ou migrer

### Installation

Téléchargez le dernier installeur Windows depuis la page [Releases](https://github.com/Pal-temps/magick-cookie/releases).

### Développement

```bash
# Prérequis : Bun, Rust, Node (pour Tauri)
bun install
bun run dev          # Lance API + Desktop en parallèle
bun run test         # Tests unitaires (1300+)
bun run db:migrate   # Migrations Drizzle
```

### Architecture

```
apps/
  desktop/         → App Tauri v2 (SolidJS + TypeScript + Rust)
    src/           → Frontend SolidJS : stores, composants, styles
    src-tauri/     → Backend Rust : IA, vault KDBX, screenshot, PTY, Git, FS
  api/             → Backend Bun/Hono : tools IA, flux, analytics
tools/
  screenshot-cli/  → CLI Rust pour capture d'écran
  benchmark-cli/   → CLI Rust pour benchmarking
```

### Stack technique

| Couche | Technologies |
|--------|-------------|
| Desktop UI | SolidJS + TypeScript |
| Desktop Shell | Tauri v2 (Rust) |
| Backend API | Bun + Hono + Drizzle ORM |
| Base de données | SQLite |
| Secrets | KDBX (KeePass) via Rust |
| Installer | NSIS (Windows) |
| Tests | bun test (1300+ tests) |

### Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) · [Wiki](https://github.com/Pal-temps/magick-cookie/wiki) · Ouvrir une [issue](https://github.com/Pal-temps/magick-cookie/issues)

### Licence

[PolyForm Noncommercial License 1.0.0](LICENSE) — usage non-commercial uniquement.

---

## 🇬🇧 English

### What is it?

Magick Cookie is a local-first, AI-powered workspace. It is designed for entrepreneurs, freelancers and creators who want to manage their projects efficiently without mastering traditional development tools.

The application is built on **four pillars**:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   📁 Markdown files     🔐 KDBX Vault           │
│   All your data in      Your encrypted secrets  │
│   human-readable text   (API keys, tokens...)   │
│           ↕                     ↕               │
│   ⚙️  Settings          🤖 Cookia (AI)           │
│   Configure your        Your assistant that     │
│   environment once      pilots everything       │
│                                                 │
└─────────────────────────────────────────────────┘
```

- **Markdown files** — your notes, configs and data stay in readable, portable `.md` files, syncable via Git
- **KDBX Vault** — your secrets (API keys, tokens) are encrypted locally in KeePass format, never sent to a server
- **Settings** — configure your tools once (LLM, Git, calendar...) and Cookia handles the rest
- **Cookia** — your AI that reads your context (.md files, vault, projects) and helps you move forward

### What you can do

| Module | Features |
|--------|----------|
| 🤖 **IDE / Cookia** | Multi-session AI chat, terminal, code generation, diff |
| 📅 **Calendar** | Events, CalDAV sync, smart reminders |
| 📝 **Notes** | Markdown, Excalidraw, backlinks, Git sync |
| 📥 **Flux** | Unified inbox (tasks, emails, articles) as Kanban/Swipe |
| 📧 **Email** | Multi-account IMAP/SMTP client |
| 📡 **RSS** | Reader + AI digest |
| 🔐 **Passwords** | KDBX secrets manager |
| 🚀 **CI/CD** | GitHub Actions, GitLab, pipelines, PRs |
| 🖥️ **VPS** | Real-time monitoring, SSE logs |
| 🌐 **Browser** | Integrated browser with bookmarks |
| 🛠️ **Tools** | Env checker, changelog generator |

### Local-first & privacy

- **No telemetry** — your data never leaves your machine by default
- **Offline-ready** — works without a connection, syncs when available
- **You stay in control** — everything lives in files you can read, backup or migrate

### Installation

Download the latest Windows installer from the [Releases](https://github.com/Pal-temps/magick-cookie/releases) page.

### Development

```bash
# Prerequisites: Bun, Rust, Node (for Tauri)
bun install
bun run dev          # Starts API + Desktop in parallel
bun run test         # Unit tests (1300+)
bun run db:migrate   # Drizzle migrations
```

### Architecture

```
apps/
  desktop/         → Tauri v2 app (SolidJS + TypeScript + Rust)
    src/           → SolidJS frontend: stores, components, styles
    src-tauri/     → Rust backend: AI, KDBX vault, screenshot, PTY, Git, FS
  api/             → Bun/Hono backend: AI tools, flux, analytics
tools/
  screenshot-cli/  → Standalone Rust CLI for screenshots
  benchmark-cli/   → Standalone Rust CLI for benchmarking
```

### Tech stack

| Layer | Technologies |
|-------|-------------|
| Desktop UI | SolidJS + TypeScript |
| Desktop Shell | Tauri v2 (Rust) |
| Backend API | Bun + Hono + Drizzle ORM |
| Database | SQLite |
| Secrets | KDBX (KeePass) via Rust |
| Installer | NSIS (Windows) |
| Tests | bun test (1300+ tests) |

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) · [Wiki](https://github.com/Pal-temps/magick-cookie/wiki) · Open an [issue](https://github.com/Pal-temps/magick-cookie/issues)

### License

[PolyForm Noncommercial License 1.0.0](LICENSE) — non-commercial use only.
