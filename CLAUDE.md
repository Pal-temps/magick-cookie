# Magick Cookie (Do-It-Now)

## Stack

- **Desktop** : Tauri v2 (Rust backend) + SolidJS + TypeScript
- **API** : Bun + Hono + Drizzle ORM + SQLite
- **Runtime** : Bun (pas Node)
- **Package manager** : pnpm (workspaces dans `apps/*`)
- **Tests** : `bun test` (API + Desktop unit tests)
- **Langues** : Francais dans l'UI, anglais dans le code

## Architecture

```
apps/
  desktop/         → App Tauri (SolidJS frontend + Rust backend)
    src/           → SolidJS: stores, components, styles
    src-tauri/     → Rust: AI adapters, secrets KDBX, screenshot, pty, git, fs
  api/             → Backend Bun/Hono: agent tools, flux, analytics, deploy
  mail-server/     → Docker mail stack (Postfix/Dovecot)
tools/
  screenshot-cli/  → CLI Rust standalone pour capture d'ecran
```

## Developpement

```bash
bun run dev          # Lance API + Desktop en parallele
bun run test         # Tests unitaires API
bun run db:migrate   # Migrations Drizzle
```

## Conventions

- RTK (Rust Token Killer) pour les commandes shell — prefixer avec `rtk`
- Stores SolidJS : signaux globaux, pas de contexte React
- Rust : `cargo check` doit passer sans warnings
- TypeScript : `tsc --noEmit` doit passer (ignorer les erreurs pre-existantes dans bun:test imports)
- Commits : `feat:`, `fix:`, `chore:` — messages en anglais

## Screenshot Tool

Tu as acces a un outil de capture d'ecran pour voir l'application.

**Commande :**
```bash
tools/screenshot-cli/target/release/screenshot.exe --full -o /tmp/screen.png
```

**Puis lis l'image :**
```
Read /tmp/screen.png
```

Tu es multimodal — tu peux voir et analyser l'image directement.

Options :
- `--full` : capture plein ecran sans GUI
- `-o <path>` : chemin de sortie
- `--max-width 1280` : resize pour optimiser les tokens (defaut)
- Sans `--full` : ouvre une fenetre de selection de zone (interactif, pour l'utilisateur)
