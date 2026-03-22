# IDE

> Statut : **Done** — Editeur Monaco, file explorer, onglets, PTY terminal, git interactif (branches/push/pull), AI panel multi-provider (Right Panel), diff preview.

IDE integre independant de Notes, base sur Monaco Editor, avec AI multi-provider (Claude CLI, Codex, Anthropic, OpenAI, Ollama) inspire de Companion.

## Architecture

```
desktop/src/
├── application/stores/
│   ├── ideStore.ts                  # Projets, tabs, file tree, CRUD, shortcuts, AI panel state
│   └── aiSessionStore.ts           # Sessions AI multi-provider (messages, streaming, permissions)
├── ui/components/ide/
│   ├── MonacoEditor.tsx             # Wrapper SolidJS (themes, AI context menu, ref API)
│   ├── IdeView.tsx                  # Layout principal (sidebar + editor + AI right panel + terminal)
│   ├── EditorTabs.tsx               # Onglets (dirty, close, context menu)
│   ├── FileExplorer.tsx             # Arborescence projet + snippets virtuels + context menus
│   ├── Terminal.tsx                 # PTY terminal (portable-pty via Tauri IPC)
│   ├── GitPanel.tsx                 # Source control (status, stage, commit, branches, push/pull, log)
│   ├── AiPanel.tsx                  # Panel IA droit (380px, resizable) — wrapper principal
│   ├── AiMessageFeed.tsx            # Liste messages avec streaming, auto-scroll
│   ├── AiMessageBubble.tsx          # Bulles user/assistant/system/error avec markdown
│   ├── ToolBlock.tsx                # Tool calls collapsibles (Read, Write, Bash, Edit)
│   ├── PermissionBanner.tsx         # Permission request inline avec diff preview Monaco
│   ├── AiComposer.tsx              # Input avec context chips + quick actions adaptes au provider
│   ├── ProviderPicker.tsx           # Dropdown provider avec badges capabilities
│   ├── ResizeHandle.tsx             # Drag handle pour redimensionner le panel AI
│   └── DiffPreview.tsx              # Monaco diff editor (original vs modified, read-only)
└── ui/styles/
    └── ide.css                      # Styles complets (layout, tabs, tree, AI panel, tool blocks, permissions)

src-tauri/src/
├── ai/                              # Module AI multi-provider
│   ├── types.rs                     # AdapterEvent, Capabilities, Config (provider-agnostic)
│   ├── adapter.rs                   # Trait BackendAdapter (interface commune)
│   ├── session_manager.rs           # Gestion sessions + commandes Tauri (8 commandes)
│   ├── dedup.rs                     # Deduplication messages (rolling hash)
│   ├── event_buffer.rs              # Buffer circulaire 200 events
│   └── adapters/
│       ├── claude_cli.rs            # Claude Code CLI (NDJSON stdin/stdout)
│       └── http_api.rs              # Anthropic/OpenAI/Ollama/LmStudio (SSE/NDJSON HTTP)
├── pty.rs                           # PTY terminal (portable-pty, persistant)
├── fs.rs                            # Commandes FS generiques
└── git.rs                           # Commandes git (status, diff, stage, commit, branches, push/pull)
```

## Acces

- **Raccourci** : Ctrl+4
- **Menu** : IDE dans la sidebar et la tab bar
- **ViewMode** : `"ide"`

## Fonctionnalites

### Editeur Monaco
- Syntax highlighting 30+ langages
- Minimap, bracket matching, multi-curseurs
- 3 themes : dark (vs-dark), light (vs), cookie (chocolat/caramel custom)
- Word wrap automatique pour markdown
- Actions IA dans le context menu (clic droit)

### Gestion de projets
- Ouvrir n'importe quel dossier via folder picker natif OS (`tauri-plugin-dialog`)
- Arborescence recursive avec fichiers caches visibles (.env, .gitignore, etc.)
- Exclusions auto : .git, node_modules, target, __pycache__, .next, .nuxt
- CRUD : nouveau fichier, nouveau dossier, renommer, supprimer
- Context menus complets (fichiers, dossiers, zone vide)
- Snippets DB affiches comme dossier virtuel

### Onglets
- Multi-fichiers avec indicateur dirty (point)
- Fermer : bouton X, clic milieu, Ctrl+W
- Context menu : fermer, fermer les autres, tout fermer, copier le chemin
- Sauvegarder : Ctrl+S

### Terminal
- xterm.js + `tauri-plugin-shell`
- PowerShell (Windows) / bash (Linux/macOS)
- CWD = dossier du projet actif
- Toggle : Ctrl+`
- Themes coherents avec l'app
- Commandes : clear/cls, Ctrl+C, Ctrl+L

### Git interactif
- Detection auto si le dossier est un repo git
- Sections STAGED / CHANGES avec compteurs
- Stage/unstage par fichier ou en lot
- Discard (annuler modifications)
- Commit avec message (Ctrl+Enter)
- Historique (hash, message, auteur, date)

### Assistant IA
- Panel lateral avec 5 boutons rapides : Expliquer, Refactorer, Corriger, Tests, Documenter
- Chat libre contextuel (envoie le fichier actif + selection)
- Bouton "Appliquer le code" pour inserer le code genere au curseur
- Context menu Monaco : clic droit → "IA: Expliquer", "IA: Refactorer", etc.

## API endpoints IA

```
POST /api/code/explain      # { code, language, question? }
POST /api/code/refactor     # { code, language, instruction? }
POST /api/code/generate     # { description, language, context? }
POST /api/code/fix          # { code, language, error? }
POST /api/code/tests        # { code, language, framework? }
POST /api/code/document     # { code, language }
```

## Agent tools

| Tool | Description |
|------|-------------|
| `list_project_files` | Arborescence d'un projet (profondeur configurable) |
| `read_project_file` | Lire un fichier (tronque a 50K chars) |
| `write_project_file` | Ecrire/modifier un fichier |
| `search_in_project` | Grep dans un projet (pattern + glob) |

Securise par variable d'env `CODE_PROJECTS` (liste de chemins autorises).

## Commandes Tauri (Rust)

### fs.rs (filesystem generique)
| Commande | Description |
|----------|-------------|
| `fs_list_dir(base_path)` | Walk recursif, exclut .git/node_modules/target |
| `fs_read_file(path)` | Lire un fichier absolu |
| `fs_write_file(path, content)` | Ecrire (cree les parents) |
| `fs_delete(path)` | Supprimer fichier ou dossier |
| `fs_create_dir(path)` | Creer un dossier |
| `fs_rename(old, new)` | Renommer |

### git.rs (git interactif)
| Commande | Description |
|----------|-------------|
| `git_is_repo(path)` | Verifie si c'est un repo git |
| `git_status(path)` | Status porcelain (staged/unstaged) |
| `git_diff(path, file?, staged?)` | Diff texte |
| `git_stage(path, files)` | git add |
| `git_unstage(path, files)` | git restore --staged |
| `git_commit(path, message)` | git commit -m |
| `git_log(path, file?, limit?)` | Historique |
| `git_discard(path, files)` | git checkout -- |

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| Ctrl+4 | Ouvrir l'IDE |
| Ctrl+S | Sauvegarder le fichier actif |
| Ctrl+W | Fermer l'onglet actif |
| Ctrl+B | Toggle sidebar |
| Ctrl+` | Toggle terminal |

## Dependances ajoutees

| Package | Licence |
|---------|---------|
| `monaco-editor` | MIT |
| `vite-plugin-monaco-editor` | MIT |
| `@tauri-apps/plugin-dialog` | MIT |
| `tauri-plugin-dialog` (Rust) | MIT |
| `@tauri-apps/plugin-shell` | MIT |
| `tauri-plugin-shell` (Rust) | MIT |
| `xterm` | MIT |
| `@xterm/addon-fit` | MIT |
