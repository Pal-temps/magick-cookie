# Plan — IDE IA integre a Magick Cookie

## Objectif

IDE independant de Notes, base sur Monaco Editor, avec gestion de projets (dossiers arbitraires), terminal integre, git interactif, et features IA. Notes reste une vue separee pour le vault markdown personnel.

---

## Etat d'avancement

| Phase | Statut | Contenu |
|-------|--------|---------|
| 1 | Done | Monaco Editor foundation (wrapper, Vite workers, theme cookie) |
| 2 | Done | Vue IDE unifiee (ideStore, FileExplorer, EditorTabs, IdeView, ide.css) |
| 2b | Done | Decouplage IDE/Notes — commandes Tauri FS generiques (`fs.rs`), folder picker natif (`tauri-plugin-dialog`), context menus complets |
| 3 | Done | Terminal integre (tauri-plugin-shell + xterm.js) |
| 4 | Done | Git interactif (git.rs + GitPanel + sidebar tabs) |
| 5 | Done | Features IA (code.tools, code.routes, AiAssistant, Monaco context menu) |
| 6 | Done | Nettoyage (wiki-link dead code NotesView, handleContentKeyDown SnippetView, pendingAiCode) |
| 7 | Done | Documentation (features/ide.md, README, llm.md, agent.md, plan) |

---

## Ce qui a ete fait

### Phase 1 — Monaco Editor Foundation (Done)

**Fichiers crees :**
- `apps/desktop/src/ui/components/ide/MonacoEditor.tsx` — wrapper SolidJS avec mount/dispose lifecycle, sync bidirectionnel, detection de langage par extension, 3 themes (dark→vs-dark, light→vs, cookie→theme custom chocolat/caramel)

**Fichiers modifies :**
- `vite.config.ts` — plugin `vite-plugin-monaco-editor` (workers TS/JSON/CSS/HTML)
- `package.json` — `+monaco-editor`, `+vite-plugin-monaco-editor`
- `NotesView.tsx` — textarea → `<MonacoEditor language="markdown" />`
- `SnippetView.tsx` — textarea edit → `<MonacoEditor language={formLanguage()} />`, `<pre><code>` preview → `<MonacoEditor readOnly />`

### Phase 2 — Vue IDE unifiee (Done)

**Fichiers crees :**
- `apps/desktop/src/application/stores/ideStore.ts` — gestion projets, tabs (open/close/switch/save/dirty), file tree builder, expand/collapse, CRUD fichiers/dossiers, rename, copier chemin, keyboard shortcuts (Ctrl+S/W/B/`)
- `apps/desktop/src/ui/components/ide/EditorTabs.tsx` — onglets avec dirty indicator, close, middle-click close, context menu (fermer/fermer les autres/tout fermer/copier chemin)
- `apps/desktop/src/ui/components/ide/FileExplorer.tsx` — arborescence projet avec context menus (nouveau fichier, nouveau dossier, renommer, supprimer, copier chemin), snippets en dossier virtuel
- `apps/desktop/src/ui/components/ide/IdeView.tsx` — layout sidebar + editor + bottom panel, dialog "ouvrir un projet" via folder picker natif OS, dialog nouveau fichier/dossier
- `apps/desktop/src/ui/styles/ide.css` — styles complets (layout, tabs, tree, context menus, bottom panel)

**Fichiers modifies :**
- `types.ts` — `+ViewMode "ide"`
- `viewStore.ts` — `+"ide"` dans navigatePrev/Next
- `App.tsx` — `+IdeView` import/Show/nav-ide handler/exclusion calendrier
- `AppLayout.tsx` — `+IDE` dans menu sidebar et tab bar
- `shortcutStore.ts` — `+nav-ide` (Ctrl+4), Notes perd son raccourci

### Phase 2b — Decouplage IDE/Notes (Done)

**Fichiers crees :**
- `apps/desktop/src-tauri/src/fs.rs` — commandes Tauri generiques :
  - `fs_list_dir(base_path)` — walk recursif (exclut .git, node_modules, target, etc.)
  - `fs_read_file(path)` — lire un fichier absolu
  - `fs_write_file(path, content)` — ecrire (cree les parents)
  - `fs_delete(path)` — supprimer fichier ou dossier
  - `fs_create_dir(path)` — creer un dossier
  - `fs_rename(old_path, new_path)` — renommer

**Fichiers modifies :**
- `Cargo.toml` — `+tauri-plugin-dialog`
- `lib.rs` — `+mod fs`, `+plugin dialog`, `+6 commandes fs_*`
- `capabilities/default.json` — `+"dialog:default"`
- `package.json` — `+@tauri-apps/plugin-dialog`
- `ideStore.ts` — refactorise : plus de dependance notesStore, utilise `fs_*` commands, gestion projets independante
- `IdeView.tsx` — folder picker natif OS au lieu de dialog texte
- `FileExplorer.tsx` — context menus fichiers/dossiers/zone vide

---

## Ce qui reste a faire

### Phase 3 — Terminal integre

#### 3.1 Installer tauri-plugin-shell

**Modifier** : `Cargo.toml`
```toml
tauri-plugin-shell = "2"
```

**Modifier** : `lib.rs`
```rust
.plugin(tauri_plugin_shell::init())
```

**Modifier** : `capabilities/default.json` — ajouter `"shell:default"`, `"shell:allow-spawn"`

**Installer** : `bun add @tauri-apps/plugin-shell xterm @xterm/addon-fit`

#### 3.2 Creer le composant Terminal

**Creer** : `apps/desktop/src/ui/components/ide/Terminal.tsx`
- `xterm.js` pour le rendu
- `@tauri-apps/plugin-shell` → `Command.create("cmd")` (Windows) / `bash` (Linux/macOS)
- Connecter stdin/stdout/stderr aux streams xterm
- Support multi-onglets terminal
- Toggle via Ctrl+`

#### 3.3 Style terminal

**Modifier** : `apps/desktop/src/ui/styles/ide.css` — ajouter styles xterm coherents avec les 3 themes

#### 3.4 Integrer dans IdeView

Remplacer le placeholder "Terminal sera disponible en Phase 3" par le vrai composant `<Terminal />` dans le bottom panel.

#### 3.5 Tests Phase 3

| Test | Description |
|------|-------------|
| Shell spawn | Ouvrir un terminal → shell demarre |
| Commandes | Taper `echo hello` → output affiche |
| CWD | Le terminal ouvre dans le dossier du projet actif |
| Multi-tab | Ouvrir 2 terminaux → switcher |
| Resize | Redimensionner → xterm s'adapte |

---

### Phase 4 — Git interactif

#### 4.1 Commandes git Tauri

**Creer** : `apps/desktop/src-tauri/src/git.rs`

```rust
fn git_status(project_path: String) -> Result<Vec<GitFileStatus>, String>
fn git_diff(project_path: String, file_path: Option<String>) -> Result<String, String>
fn git_stage(project_path: String, files: Vec<String>) -> Result<(), String>
fn git_unstage(project_path: String, files: Vec<String>) -> Result<(), String>
fn git_commit(project_path: String, message: String) -> Result<(), String>
fn git_log(project_path: String, file: Option<String>, limit: Option<u32>) -> Result<Vec<GitLogEntry>, String>
```

#### 4.2 GitPanel

**Creer** : `apps/desktop/src/ui/components/ide/GitPanel.tsx`
- Panel lateral (onglet "Git" dans la sidebar IDE)
- Liste fichiers changes (modified, staged, untracked)
- Boutons stage/unstage/commit
- Clic sur fichier → diff view

#### 4.3 Diff view Monaco

Utiliser `monaco.editor.createDiffEditor()` — original (HEAD) vs modified.

#### 4.4 Decorations dans FileExplorer

Icones/couleurs pour fichiers modifies (M), ajoutes (+), supprimes (-).

#### 4.5 Tests Phase 4

| Test | Description |
|------|-------------|
| Status | Modifier un fichier → apparait dans GitPanel |
| Stage/unstage | Stage → passe dans "staged" |
| Diff view | Clic sur fichier modifie → diff Monaco |
| Commit | Message → commit → fichiers disparaissent |

---

### Phase 5 — Features IA

#### 5.1 Nouveaux tools agent

**Creer** : `apps/api/src/application/agent/tools/code.tools.ts`
- `read_project_file(projectPath, filePath)`
- `write_project_file(projectPath, filePath, content)`
- `search_in_project(projectPath, pattern, glob?)`
- `list_project_files(projectPath, glob?)`

#### 5.2 Endpoints code IA

**Creer** : `apps/api/src/presentation/routes/code.routes.ts`

```
POST /api/code/explain      # explication
POST /api/code/refactor     # refactoring
POST /api/code/generate     # generation
POST /api/code/fix          # correction
POST /api/code/tests        # generation tests
POST /api/code/document     # documentation
POST /api/code/complete     # FIM autocomplete (stretch)
```

#### 5.3 AiAssistant panel

**Creer** : `apps/desktop/src/ui/components/ide/AiAssistant.tsx`
- Panel lateral droit (onglet "AI" dans sidebar IDE)
- Chat contextuel (fichier actif + selection)
- Boutons : Explain, Refactor, Fix, Tests, Document
- Streaming SSE (pattern chatStore)
- Bouton "Appliquer" pour inserer le code genere

#### 5.4 Context menu Monaco

Ajouter dans `MonacoEditor.tsx` via `monaco.editor.addAction()` :
- "Expliquer la selection"
- "Refactorer"
- "Generer des tests"
- "Documenter"

#### 5.5 Inline completions (stretch)

`monaco.languages.registerInlineCompletionsProvider("*", ...)` → ghost text via `POST /api/code/complete` (FIM format).

#### 5.6 Tests Phase 5

| Test | Description |
|------|-------------|
| code.tools | read/write/search project files |
| Endpoints | explain, refactor, generate retournent du code |
| AiAssistant | Question → reponse streamee |
| Context menu | Selection → "Expliquer" → AI panel |

---

### Phase 6 — Nettoyage

- Verifier que NotesView fonctionne toujours independamment avec Monaco
- Supprimer le code wiki-link textarea-dependant de NotesView (mort depuis Phase 1) — reimplementer via Monaco CompletionProvider si necessaire
- Supprimer `handleContentKeyDown` (tab indent) de SnippetView (Monaco gere nativement)
- Scanner le dead code avec les memes outils que le refactor precedent
- Verifier que `highlight.js` reste utilise (ChatView) avant de le retirer des deps

---

### Phase 7 — Tests + documentation

#### Tests unitaires a creer

| Fichier | Couverture |
|---------|-----------|
| `ideStore.test.ts` | openProject, openFile, closeTab, saveTab, dirty state, createFile, deleteFile, renameFile, closeOtherTabs, closeAllTabs |
| `code.tools.test.ts` | read/write/search project files, securite chemins |
| `code.routes.test.ts` | explain, refactor, generate, fix, tests, document |

#### Documentation a mettre a jour

- `docs/README.md` — ajouter IDE dans la liste des features
- `docs/features/ide.md` — creer (architecture, composants, commandes Tauri, API, raccourcis)
- `docs/features/llm.md` — ajouter usages code (explain, refactor, complete)
- `docs/features/agent.md` — ajouter tools code
- `docs/features/dev-tools.md` — section Snippets → pointer vers IDE pour l'edition
- `docs/plans/ide-integration.md` — marquer tout comme done

---

## Dependances ajoutees

| Package | Licence | Phase | Statut |
|---------|---------|-------|--------|
| `monaco-editor` | MIT | 1 | Installe |
| `vite-plugin-monaco-editor` | MIT | 1 | Installe |
| `@tauri-apps/plugin-dialog` | MIT | 2b | Installe |
| `tauri-plugin-dialog` (Rust) | MIT | 2b | Installe |
| `@tauri-apps/plugin-shell` | MIT | 3 | A installer |
| `tauri-plugin-shell` (Rust) | MIT | 3 | A installer |
| `xterm` | MIT | 3 | A installer |
| `@xterm/addon-fit` | MIT | 3 | A installer |

## Dependances API

Aucune nouvelle dependance API. Les features IA (Phase 5) reutilisent `LlmService` existant.
