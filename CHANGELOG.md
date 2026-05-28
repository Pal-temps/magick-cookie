# Changelog

All notable changes to Magick Cookie will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- GitHub Actions release workflow for Windows NSIS installer

---

## [0.1.0] — Unreleased (v1 candidate)

### Added
- **IDE / Cookia** — AI assistant with multi-session support, streaming responses, PTY terminal tabs
- **Dashboard** — Widget grid (Timer, Water, Dog walk, Calendar, Stats, GitHub PRs, VPS, Wellness…)
- **Calendar** — Month/Week/Day views, CalDAV sync, smart reminders (SSE)
- **Notes** — Markdown editor, Excalidraw integration, backlinks, git sync
- **Flux** — Smart inbox with Kanban, Swipe and Timeline views
- **Email** — Multi-account IMAP/SMTP client, HTML rendering, rules, digest AI
- **RSS** — Feed reader, article digest AI, save to notes, send to Cookia
- **CI/CD** — GitHub Actions & GitLab pipelines, PRs, deploys, releases, webhooks
- **Passwords** — KDBX vault, password generator, SSH key manager
- **VPS** — Real-time log streaming (SSE), alerts, server status monitoring
- **Browser** — Built-in WebView with bookmarks
- **Tools** — Environment checker, Changelog generator
- **DevOps CLI** — Runtime install of `gh` via BinaryManager, GitHub OAuth auth
- **Settings** — 21 configuration tabs (LLM, CalDAV, Email rules, Shortcuts, DevOps CLI…)
- **First-run wizard** — NSIS installer with bootstrap.json, folder & git remote setup
- **i18n** — Full French & English UI support
- **Theme** — Light and dark mode
- **Command palette** — Ctrl+K global search
- **Quick capture** — Global shortcut to create tasks
- **Focus mode** — Full-screen Pomodoro overlay
- **Desktop mode** — Floating widgets overlay
- **KDBX vault** — Encrypted secrets storage (KeePass format)
- **AI tool permissions** — Enable/disable Cookia tools per user

### Technical
- Tauri v2 + SolidJS + TypeScript frontend
- Bun + Hono + Drizzle ORM + SQLite backend
- 1300+ unit and integration tests
- NSIS Windows installer with language selector (FR/EN)

---

<!-- Links -->
[Unreleased]: https://github.com/Pal-temps/magick-cookie/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pal-temps/magick-cookie/releases/tag/v0.1.0
