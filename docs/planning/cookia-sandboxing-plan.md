# Plan — Contrôle maximal des actions de Cookia (Claude CLI)

**Date :** 2026-05-26  
**Statut :** 🟡 Planification  
**Philosophie :** Rien n'est interdit — tout est visible et confirmable.

---

## 1. Objectif

Quand Cookia (Claude CLI) veut faire une action sensible (écrire un fichier,
exécuter Bash, accéder à un dossier hors projet…), l'application :

1. **Intercepte** la demande avant qu'elle ne s'exécute
2. **Affiche** une confirmation dans l'UI (quel outil, sur quel fichier/dossier)
3. **Attend** la réponse de l'utilisateur → autorisé ou refusé
4. **Loggue** la décision dans l'audit trail

MCPs (Playwright, serveurs MCP externes) → ils ont leur propre cycle de
permission, on ne touche pas à ça.

---

## 2. Le mécanisme : `--permission-prompt-tool`

Claude Code CLI expose un flag peu connu mais très puissant :

```bash
claude --permission-prompt-tool mcp__<server>__<tool_name> ...
```

Quand ce flag est présent, **chaque fois que Claude veut faire une action
qui nécessite une permission** (écrire un fichier, exécuter Bash, lire
hors du projet…), au lieu de demander interactivement dans le terminal,
il appelle l'outil MCP spécifié avec les détails de la demande.

L'outil reçoit :
```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "/some/path/file.txt", "content": "..." },
  "tool_use_id": "toolu_abc123"
}
```

Et retourne :
```json
{ "behavior": "allow" }
// ou
{ "behavior": "deny", "message": "Refusé par l'utilisateur" }
```

**C'est le seul endroit où on a une main sur chaque action sensible.**

---

## 3. Architecture cible

```
Claude CLI (--print --permission-prompt-tool mcp__magick_perm__ask)
    │
    │ JSON-RPC stdio
    ▼
MCP Permission Server (nouveau, stdio, léger)
    │
    │ emit Tauri event "ai-permission-request"
    ▼
Frontend → Dialog de confirmation (quel outil ? quel fichier ?)
    │
    │ Tauri invoke "ai_resolve_permission"
    ▼
MCP Permission Server → répond { behavior: "allow" | "deny" }
    │
    ▼
Claude CLI continue (ou abandonne)
```

---

## 4. État actuel du code

Dans `claude_cli.rs`, `respond_permission` est un **no-op** :
```rust
fn respond_permission(&mut self, _request_id: String, _allowed: bool) -> Result<(), String> {
    // Permission handling is not supported in --print/--resume mode
    // Claude CLI handles permissions based on --permission-mode flag
    Ok(())
}
```

La plomberie Tauri existe (`ai_respond_permission` command, `PermissionRequest`
event type dans `types.rs`) mais n'est pas câblée côté CLI.

**Ce plan est l'implémentation de ce qui était marqué TODO.**

---

## 5. Plan d'implémentation

### Étape 1 — MCP Permission Server (Rust, stdio) (~3h)

Nouveau fichier : `apps/desktop/src-tauri/src/ai/permission_mcp_server.rs`

Un serveur MCP minimal en stdio qui :
- Écoute les requêtes JSON-RPC de Claude CLI
- Répond à `tools/list` avec l'outil `ask`
- Sur `tools/call` → émet un event Tauri `ai-permission-request` et
  **bloque** jusqu'à recevoir la réponse via un channel

```rust
pub struct PermissionMcpServer {
    app_handle: AppHandle,
    /// Pending requests: request_id → oneshot sender
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}
```

Le server tourne dans un thread dédié par session, en stdio, spawné
juste avant Claude CLI.

---

### Étape 2 — Spawn Claude CLI avec `--permission-prompt-tool` (~1h)

**Fichier :** `apps/desktop/src-tauri/src/ai/adapters/claude_cli.rs`

```rust
// Démarre le MCP permission server sur un pipe stdio
let (perm_server_stdin, perm_server_stdout) = spawn_permission_server(&app_handle)?;

// Passe le MCP config à Claude CLI
let mcp_config = json!({
  "mcpServers": {
    "magick_perm": {
      "command": std::env::current_exe()?,  // le binaire Tauri lui-même
      "args": ["--mcp-permission-server"],  // mode serveur MCP
    }
  }
});
let mcp_config_path = write_temp_json(&mcp_config)?;

let args = vec![
    "--print",
    "--output-format", "stream-json",
    "--permission-prompt-tool", "mcp__magick_perm__ask",
    "--mcp-config", &mcp_config_path,
    "-p", prompt,
];
```

---

### Étape 3 — Résoudre la permission côté Tauri (~1h)

**Fichier :** `apps/desktop/src-tauri/src/ai/session_manager.rs`

`respond_permission` n'est plus un no-op :

```rust
fn respond_permission(&mut self, request_id: String, allowed: bool) -> Result<(), String> {
    self.permission_server
        .resolve(request_id, allowed)
        .map_err(|e| e.to_string())
}
```

---

### Étape 4 — Dialog de confirmation dans l'UI (~2h)

**Fichier :** `apps/desktop/src/ui/components/ide/PermissionDialog.tsx`

Quand l'event `ai-permission-request` arrive, afficher un dialog :

```
┌─────────────────────────────────────────┐
│ 🔐 Cookia demande une permission        │
│                                         │
│ Outil   : Write                         │
│ Fichier : src/components/MyComp.tsx     │
│                                         │
│ [Refuser]              [Autoriser ✓]    │
└─────────────────────────────────────────┘
```

Timeout de 30s → refus automatique si pas de réponse.

---

### Étape 5 — Fix du fallback cwd (~20 min)

Partout où `ide.projectPath() ?? "."` existe, remplacer par un guard :

```typescript
// IdeSidebarContent.tsx, AiTerminalTabs.tsx, ContextPanel.tsx, PastSessionViewer.tsx
const cwd = ide.projectPath();
if (!cwd) {
  toast.error(t("ide.errors.no_project_open"));
  return;
}
```

Le `cwd` est la frontière naturelle : Claude Code en mode `--print`
ne peut pas écrire hors du `cwd` via `Write`/`Edit` sans déclencher
une demande de permission.

---

## 6. Ce qui est contrôlé vs ce qui est libre

| Action | Contrôle |
|--------|----------|
| Écriture dans le projet | ✅ Libre (dans le cwd) |
| Écriture hors projet | 🔐 Dialog de confirmation |
| Exécution Bash dans le projet | 🔐 Dialog de confirmation |
| Exécution Bash système | 🔐 Dialog de confirmation |
| Lecture de fichiers | ✅ Libre (Claude peut lire) |
| MCPs (Playwright, etc.) | ✅ Libres — pas affectés |
| Appels réseau via outils Claude | 🔐 Dialog de confirmation |

---

## 7. Ce qu'on gagne vs l'état actuel

| Avant | Après |
|-------|-------|
| Claude écrit n'importe où sans que tu le saches | Dialog avant toute écriture hors projet |
| `respond_permission` = no-op | Vrai canal de confirmation |
| Aucune visibilité sur les actions sensibles | Chaque permission loggée |
| MCPs et outils libres (voulu) | Inchangé |

---

## 8. Ordre d'implémentation

```
Étape 5 (20 min)  → Fix fallback cwd   [quick win, indépendant]
Étape 1 (3h)      → MCP Permission Server Rust
Étape 2 (1h)      → --permission-prompt-tool dans spawn
Étape 3 (1h)      → respond_permission câblé
Étape 4 (2h)      → Dialog UI

Total : ~7h30
```

---

## 9. Fichiers touchés

| Fichier | Action |
|---------|--------|
| `src-tauri/src/ai/permission_mcp_server.rs` | Créer |
| `src-tauri/src/ai/adapters/claude_cli.rs` | Spawn MCP server + `--permission-prompt-tool` |
| `src-tauri/src/ai/session_manager.rs` | Câbler `respond_permission` |
| `src-tauri/src/lib.rs` | Enregistrer le module + command |
| `src/ui/components/ide/PermissionDialog.tsx` | Créer |
| `src/ui/components/ide/AiChatContent.tsx` | Écouter `ai-permission-request` → ouvrir dialog |
| `src/ui/components/sidebar/IdeSidebarContent.tsx` | Guard cwd null |
| `src/ui/components/ide/AiTerminalTabs.tsx` | Guard cwd null |
| `src/ui/components/ide/ContextPanel.tsx` | Guard cwd null |
| `src/ui/components/ide/PastSessionViewer.tsx` | Guard cwd null |
