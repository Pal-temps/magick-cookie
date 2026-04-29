<div align="center">

# 🍪 Magick Cookie

**FR** · L'IDE intelligent qui vous veut du bien  
**EN** · The intelligent IDE that has your back

[![CI](https://github.com/Pal-temps/magick-cookie/actions/workflows/ci.yml/badge.svg)](https://github.com/Pal-temps/magick-cookie/actions/workflows/ci.yml)
[![License: PolyForm NC](https://img.shields.io/badge/license-PolyForm%20NC-blue)](LICENSE)

</div>

---

> [🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

---

## 🇫🇷 Français

### Qu'est-ce que c'est ?

Magick Cookie est un IDE de bureau intégrant des agents IA, un terminal, un gestionnaire de secrets (KDBX), et des outils de développement — le tout dans une interface unifiée construite avec Tauri et SolidJS.

### Stack technique

| Couche | Technologies |
|--------|-------------|
| Desktop | Tauri v2 (Rust) + SolidJS + TypeScript |
| API | Bun + Hono + Drizzle ORM + SQLite |
| Runtime | Bun |
| Package manager | pnpm (workspaces) |

### Installation

```bash
pnpm install
```

### Développement

```bash
bun run dev          # Lance API + Desktop en parallèle
bun run test         # Tests unitaires API
bun run db:migrate   # Migrations Drizzle
```

### Architecture

```
apps/
  desktop/     → App Tauri (SolidJS frontend + Rust backend)
  api/         → Backend Bun/Hono
tools/
  screenshot-cli/   → CLI Rust pour capture d'écran
  benchmark-cli/    → CLI Rust pour benchmark & profiling
```

### Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) · Ouvrir une [issue](https://github.com/Pal-temps/magick-cookie/issues)

### Licence

[PolyForm Noncommercial License 1.0.0](LICENSE) — usage non-commercial uniquement.

---

## 🇬🇧 English

### What is it?

Magick Cookie is a desktop IDE integrating AI agents, a terminal, a secrets manager (KDBX), and developer tools — all in a unified interface built with Tauri and SolidJS.

### Tech stack

| Layer | Technologies |
|-------|-------------|
| Desktop | Tauri v2 (Rust) + SolidJS + TypeScript |
| API | Bun + Hono + Drizzle ORM + SQLite |
| Runtime | Bun |
| Package manager | pnpm (workspaces) |

### Installation

```bash
pnpm install
```

### Development

```bash
bun run dev          # Starts API + Desktop in parallel
bun run test         # API unit tests
bun run db:migrate   # Drizzle migrations
```

### Architecture

```
apps/
  desktop/     → Tauri app (SolidJS frontend + Rust backend)
  api/         → Bun/Hono backend
tools/
  screenshot-cli/   → Standalone Rust CLI for screenshots
  benchmark-cli/    → Standalone Rust CLI for benchmarking
```

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) · Open an [issue](https://github.com/Pal-temps/magick-cookie/issues)

### License

[PolyForm Noncommercial License 1.0.0](LICENSE) — non-commercial use only.
