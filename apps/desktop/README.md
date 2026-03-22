# Magick Cookie — Desktop

App desktop Tauri 2 + SolidJS + TypeScript.

## Demarrage

```bash
bun install
bun run tauri dev
```

## Stack

- **Framework** : Tauri 2 (Rust backend + webview)
- **Frontend** : SolidJS + TypeScript + Vite
- **Styling** : CSS variables (3 themes)

## Structure

```
src/
├── application/stores/     # SolidJS stores (signals, effets)
├── domain/models/          # Types/interfaces frontend
├── infrastructure/api/     # apiClient, offline queue
└── ui/
    ├── components/         # Composants par feature (email/, rss/, chat/, dashboard/...)
    └── views/              # Vues principales
src-tauri/
├── src/lib.rs              # Setup Tauri, global shortcuts, window icon
└── capabilities/           # Permissions Tauri
```

## IDE

- VS Code + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
