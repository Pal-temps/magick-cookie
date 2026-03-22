# Magick Cookie

App desktop de productivite personnelle tout-en-un, self-hosted, avec IA locale.

## Stack technique

| Composant | Technologie |
|-----------|------------|
| Desktop | Tauri 2 + SolidJS + TypeScript |
| API | Hono (Bun runtime) |
| Base de donnees | PostgreSQL + Drizzle ORM |
| LLM local | Ollama (GPU NVIDIA) |
| Mail server | docker-mailserver (self-hosted) |
| Infra | Docker Compose |

## Architecture monorepo

```
apps/
├── api/          # Backend Hono — clean architecture (domain/application/infrastructure/presentation)
├── desktop/      # Frontend Tauri + SolidJS
├── llm/          # Stack Docker Ollama
└── mail-server/  # docker-mailserver self-hosted (paltemps.fr)
```

## Features implementees

### Productivite
- **Timer Pomodoro** — sessions focus/break, stats, streaks, son en boucle
- **Triage** — inbox taches, Kanban drag & drop, auto-triage IA
- **Brief quotidien** — resume IA (hier/aujourd'hui/blocages) + git scan + templates
- **Weekly Review** — bilan hebdo avec deltas semaine precedente
- **Analytics** — dashboard widgets configurables, charts, contribution graph
- **Routines** — sequences d'actions programmees (matin/soir)
- **Journal** — note quotidienne auto-generee dans le vault
- **Habits** — tracker d'habitudes custom avec objectifs et streaks

### Communication
- **Email** — inbox unifiee multi-comptes IMAP, compose/reply/forward SMTP, digest hebdo IA, classification auto, raccourcis clavier Gmail-style
- **RSS** — lecteur avec catalogue FR/EN, digest IA quotidien, retention auto, extraction Readability
- **Chat IA** — streaming SSE, markdown riche, syntax highlighting, tool-calling

### Integrations
- **Calendrier** — CalDAV sync (Google/Outlook), alarmes, generation events IA
- **GitHub** — PR watcher, CI/CD dashboard, workflow runs
- **Multi-connecteur** — GitHub Issues/PRs, GitLab Issues/Boards, ClickUp
- **VPS Monitoring** — sante serveurs

### Agent IA
- **Agent conversationnel** — tool-calling sur toutes les donnees de l'app
- **Memoire contextuelle** — faits, preferences, contexte temporaire
- **Push notifications** — brief 8h, weekly review dimanche, alertes

### IDE integre
- **Editeur Monaco** — syntax highlighting 30+ langages, 3 themes, minimap
- **File explorer** — arborescence projet, fichiers caches, snippets virtuels, context menus
- **Terminal** — xterm.js + PowerShell/bash, CWD projet
- **Git interactif** — status, stage/unstage, commit, historique, discard
- **Assistant IA** — explain, refactor, fix, tests, document + chat contextuel + context menu Monaco

### Dev Tools
- **Snippets** — code clipboard avec syntax highlighting et categories
- **Changelog generator** — git scan + LLM
- **Environment checker** — sante services locaux

### UX
- **3 themes** — Dark, Light, Cookie (chocolat/caramel)
- **Command palette** — Ctrl+K, prefixes go:/snip:/n:, historique
- **Raccourcis globaux** — Win+Shift+N (capture), +T (timer), +B (brief)
- **Focus mode** — overlay pendant les pomodoros
- **Mode offline** — queue IndexedDB + replay auto
- **Splash screen** — theme-aware avec radial glow

## Documentation

| Dossier | Contenu |
|---------|---------|
| [features/](features/) | Documentation par feature (email, RSS, agent, etc.) |
| [infrastructure/](infrastructure/) | Mail server, stack LLM |
| [design/](design/) | Themes et palettes de couleurs |
| [mobile/](mobile/) | Specs futures app Android (Kotlin) |

## Demarrage rapide

```bash
# API
cd apps/api && bun install && bun run dev

# Desktop
cd apps/desktop && bun install && bun run tauri dev

# LLM (Ollama avec GPU)
cd apps/llm && docker compose up -d

# Mail server (optionnel)
cd apps/mail-server && bun run mail:setup me@paltemps.fr changeme
```

## Tests

```bash
cd apps/api && bun test    # 575+ tests
```
