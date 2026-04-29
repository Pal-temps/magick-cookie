# Contributing / Contribuer

> [🇫🇷 Français](#-français) | [🇬🇧 English](#-english)

---

## 🇫🇷 Français

Merci de l'intérêt que tu portes à Magick Cookie !

### Signaler un bug

Utilise le template **Bug report** en ouvrant une [issue](https://github.com/Pal-temps/magick-cookie/issues/new/choose). Inclus toujours les étapes pour reproduire.

### Proposer une fonctionnalité

Utilise le template **Feature request**. Explique le contexte avant de proposer une solution.

### Soumettre une Pull Request

1. Fork le repo
2. Crée une branche : `git checkout -b feat/ma-feature`
3. Commit avec le bon préfixe : `feat:`, `fix:`, `chore:`, `docs:`
4. Ouvre une PR en liant l'issue concernée (`Closes #42`)
5. Attends la review — on répond sous 48h

### Lancer le projet

```bash
pnpm install
bun run dev          # Lance API + Desktop en parallèle
bun run test         # Tests unitaires
bun run db:migrate   # Migrations base de données
```

### Conventions

- Messages de commit en anglais
- `cargo check` sans warnings (Rust)
- `tsc --noEmit` sans erreurs (TypeScript)
- Stores SolidJS : signaux globaux, pas de Context React

### Code de conduite

Sois respectueux, constructif et bienveillant. Les contributions offensantes ne seront pas acceptées.

---

## 🇬🇧 English

Thanks for your interest in Magick Cookie!

### Reporting a bug

Use the **Bug report** template when opening an [issue](https://github.com/Pal-temps/magick-cookie/issues/new/choose). Always include steps to reproduce.

### Proposing a feature

Use the **Feature request** template. Explain the context before proposing a solution.

### Submitting a Pull Request

1. Fork the repo
2. Create a branch: `git checkout -b feat/my-feature`
3. Commit with the right prefix: `feat:`, `fix:`, `chore:`, `docs:`
4. Open a PR linking the related issue (`Closes #42`)
5. Wait for review — we respond within 48h

### Running the project

```bash
pnpm install
bun run dev          # Starts API + Desktop in parallel
bun run test         # Unit tests
bun run db:migrate   # Database migrations
```

### Conventions

- Commit messages in English
- `cargo check` must pass without warnings (Rust)
- `tsc --noEmit` must pass without errors (TypeScript)
- SolidJS stores: global signals, no React Context

### Code of conduct

Be respectful, constructive, and kind. Offensive contributions will not be accepted.
