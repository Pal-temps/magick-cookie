# Plan — IDE IA multi-provider (Companion-inspired)

## Objectif

Transformer l'IDE Magick Cookie en un IDE IA multi-provider en integrant les concepts cles de Companion (bridge CLI, streaming, permissions, tool visualization) tout en gardant une architecture generique compatible avec n'importe quel LLM.

**Principe fondamental** : L'IDE ne connait pas le provider. Tout passe par une interface commune `IBackendAdapter`. Chaque provider (Claude Code CLI, Codex CLI, Ollama, Anthropic API, OpenAI API) implemente cette interface.

---

## Architecture cible

```
┌──────────────────────────────────────────────────────────────────┐
│  IDE Magick Cookie (Tauri + SolidJS)                             │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Monaco   │  │ Terminal  │  │ Git      │  │ AI Chat Panel  │  │
│  │ Editor   │  │ (PTY)    │  │ Panel    │  │ (generique)    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────┬────────┘  │
│                                                     │            │
│                                    ┌────────────────┴──────┐    │
│                                    │  Session Manager      │    │
│                                    │  (provider-agnostic)  │    │
│                                    └────────────┬──────────┘    │
│                                                 │               │
│                           ┌─────────────────────┼───────┐       │
│                           │   IBackendAdapter    │       │       │
│                           │   (interface Rust)   │       │       │
│                           └──┬──────┬──────┬─────┘       │       │
│                              │      │      │             │       │
└──────────────────────────────┼──────┼──────┼─────────────┘       │
                               │      │      │                     │
                    ┌──────────┴┐ ┌───┴────┐ ┌┴──────────┐        │
                    │ Claude    │ │ Codex  │ │ API       │        │
                    │ Code CLI  │ │ CLI    │ │ Adapter   │        │
                    │ (NDJSON)  │ │(JSONRPC)│ │(HTTP SSE) │        │
                    └───────────┘ └────────┘ └───────────┘        │
                                                                   │
                                              ┌───────────┐       │
                                              │ Ollama /  │       │
                                              │ LM Studio │       │
                                              │ Anthropic │       │
                                              │ OpenAI    │       │
                                              └───────────┘
```

---

## L'interface commune : IBackendAdapter

C'est le coeur de l'architecture. Tous les providers implementent cette interface.

### Cote Rust (Tauri)

```rust
// Trait commun a tous les adapters
pub trait BackendAdapter: Send + Sync {
    /// Demarrer une session
    fn start(&mut self, config: SessionConfig) -> Result<(), String>;

    /// Envoyer un message utilisateur
    fn send_message(&mut self, content: String, images: Option<Vec<ImageData>>) -> Result<(), String>;

    /// Repondre a une permission
    fn respond_permission(&mut self, request_id: String, allowed: bool) -> Result<(), String>;

    /// Interrompre la generation
    fn interrupt(&mut self) -> Result<(), String>;

    /// Arreter la session
    fn stop(&mut self) -> Result<(), String>;

    /// Verifier si la session est active
    fn is_alive(&self) -> bool;

    /// Nom du provider
    fn provider_name(&self) -> &str;

    /// Capacites du provider
    fn capabilities(&self) -> AdapterCapabilities;
}

pub struct AdapterCapabilities {
    pub supports_tools: bool,          // Claude, Codex = true. Ollama basique = false
    pub supports_permissions: bool,    // Claude, Codex = true. API directe = false
    pub supports_streaming: bool,      // Tous = true
    pub supports_images: bool,         // Claude, OpenAI = true. Ollama = depends
    pub supports_file_access: bool,    // CLI adapters = true. API = false (sauf via tools)
    pub supports_terminal: bool,       // CLI adapters = true. API = false
}
```

### Messages communs (provider-agnostic)

```rust
/// Message sortant de l'adapter vers le frontend
pub enum AdapterEvent {
    /// Session initialisee
    SessionReady { model: String, tools: Vec<String> },

    /// Texte en streaming (token par token)
    StreamToken { text: String, phase: StreamPhase },

    /// Message complet de l'assistant
    AssistantMessage { content: String, model: String },

    /// L'assistant utilise un tool
    ToolUse { id: String, name: String, input: serde_json::Value },

    /// Resultat d'un tool
    ToolResult { tool_use_id: String, content: String, is_error: bool },

    /// Demande de permission
    PermissionRequest { request_id: String, tool_name: String, tool_input: serde_json::Value, description: String },

    /// Permission annulee
    PermissionCancelled { request_id: String },

    /// Progression d'un tool (temps ecoule)
    ToolProgress { tool_use_id: String, tool_name: String, elapsed_seconds: f32 },

    /// Tour termine
    TurnComplete { stop_reason: Option<String> },

    /// Erreur
    Error { message: String },

    /// Session terminee
    SessionTerminated { reason: String },
}

pub enum StreamPhase { Thinking, Text }
```

---

## Les adapters

### Adapter 1 — Claude Code CLI

Spawn `claude` CLI avec `--sdk-url` ou mode stdin/stdout NDJSON.

```rust
pub struct ClaudeCliAdapter {
    process: Option<Child>,
    session_id: String,
    dedup_hashes: VecDeque<u64>,  // Rolling window 50
}

impl BackendAdapter for ClaudeCliAdapter {
    fn start(&mut self, config: SessionConfig) -> Result<(), String> {
        // Spawn: claude -p "" --output-format stream-json --model {model}
        // Ou: claude --sdk-url ws://... (si on veut le protocol complet)
        // Lire stdout NDJSON en async
    }

    fn send_message(&mut self, content: String, _images: Option<Vec<ImageData>>) -> Result<(), String> {
        // Ecrire sur stdin: {"type": "user_message", "content": "..."}
    }
    // ...
}
```

**Mapping NDJSON → AdapterEvent** :
| NDJSON type | AdapterEvent |
|-------------|-------------|
| `system` (subtype init) | `SessionReady` |
| `stream_event` | `StreamToken` |
| `assistant` | `AssistantMessage` |
| `tool_use` | `ToolUse` |
| `tool_result` | `ToolResult` |
| `control_request` (can_use_tool) | `PermissionRequest` |
| `result` | `TurnComplete` |

**Capabilities** : `tools=true, permissions=true, streaming=true, images=true, file_access=true, terminal=true`

---

### Adapter 2 — Codex CLI (OpenAI)

Spawn `codex` CLI avec communication JSON-RPC.

```rust
pub struct CodexCliAdapter {
    process: Option<Child>,
}

impl BackendAdapter for CodexCliAdapter {
    fn start(&mut self, config: SessionConfig) -> Result<(), String> {
        // Spawn: codex --model {model} --json
    }
    // Mapping JSON-RPC → AdapterEvent
}
```

**Capabilities** : `tools=true, permissions=true, streaming=true, images=false, file_access=true, terminal=true`

---

### Adapter 3 — API HTTP (Anthropic / OpenAI / Ollama)

Pas de CLI — appel direct a l'API avec streaming SSE.

```rust
pub struct HttpApiAdapter {
    provider: ApiProvider,  // Anthropic | OpenAI | OllamaLocal
    base_url: String,
    api_key: Option<String>,
    model: String,
    messages: Vec<ChatMessage>,  // Historique conversation
}

pub enum ApiProvider { Anthropic, OpenAI, OllamaLocal, LmStudio }

impl BackendAdapter for HttpApiAdapter {
    fn start(&mut self, config: SessionConfig) -> Result<(), String> {
        // Pas de process a spawn — juste init l'etat
    }

    fn send_message(&mut self, content: String, images: Option<Vec<ImageData>>) -> Result<(), String> {
        // POST streaming vers l'API
        // Anthropic: POST /v1/messages avec stream=true
        // OpenAI: POST /v1/chat/completions avec stream=true
        // Ollama: POST /api/chat avec stream=true
        // Lire les chunks SSE, emettre StreamToken
    }
    // ...
}
```

**Mapping SSE → AdapterEvent** :

Pour Anthropic (`content_block_delta`) :
| SSE event | AdapterEvent |
|-----------|-------------|
| `message_start` | `SessionReady` |
| `content_block_delta` (type text) | `StreamToken { phase: Text }` |
| `content_block_delta` (type thinking) | `StreamToken { phase: Thinking }` |
| `content_block_start` (type tool_use) | `ToolUse` |
| `message_stop` | `TurnComplete` |

Pour OpenAI (`chat.completion.chunk`) :
| SSE event | AdapterEvent |
|-----------|-------------|
| `delta.content` | `StreamToken { phase: Text }` |
| `delta.tool_calls` | `ToolUse` |
| `finish_reason: stop` | `TurnComplete` |

Pour Ollama (`/api/chat` streaming) :
| JSON line | AdapterEvent |
|-----------|-------------|
| `{"message": {"content": "..."}}` | `StreamToken` |
| `{"done": true}` | `TurnComplete` |

**Capabilities** : `tools=depends, permissions=false, streaming=true, images=depends, file_access=false, terminal=false`

> Note : L'adapter API n'a pas acces aux fichiers/terminal. Les features "explain code" fonctionnent en envoyant le code dans le message (comme actuellement). Les features "refactor and write" necessitent un CLI adapter.

---

### Adapter 4 — LLM Service existant (bridge API Magick Cookie)

Reutilise l'infra LLM existante (`LlmService` + 4 adapters deja implementes).

```rust
pub struct MagickCookieLlmAdapter {
    // Appelle l'API locale: POST /api/llm/chat ou /api/code/*
    api_base: String,  // http://localhost:47300
}

impl BackendAdapter for MagickCookieLlmAdapter {
    fn send_message(&mut self, content: String, _images: Option<Vec<ImageData>>) -> Result<(), String> {
        // POST http://localhost:47300/api/llm/chat {messages: [...]}
        // Streaming via SSE existant
    }
}
```

**Capabilities** : `tools=false, permissions=false, streaming=true, images=false, file_access=false, terminal=false`

> C'est le fallback — fonctionne avec Ollama, LM Studio, Anthropic, OpenAI via le systeme deja en place. Pas de tool-calling mais le chat fonctionne.

---

## Phases d'implementation

### Phase 1 — Interface commune + Session Manager (Rust)

**Creer** les fichiers suivants :

```
src-tauri/src/ai/
├── mod.rs                    # Module racine
├── types.rs                  # AdapterEvent, SessionConfig, AdapterCapabilities
├── adapter.rs                # Trait BackendAdapter
├── session_manager.rs        # Gestion des sessions (Map<id, Box<dyn BackendAdapter>>)
├── dedup.rs                  # Deduplication par hash (reutilisable par tous les adapters)
├── event_buffer.rs           # Buffer circulaire (200 events)
└── adapters/
    ├── mod.rs
    ├── claude_cli.rs          # Claude Code CLI adapter
    └── http_api.rs            # Adapter HTTP generique (Anthropic/OpenAI/Ollama)
```

**Session Manager** (Rust) :

```rust
pub struct SessionManager {
    sessions: HashMap<String, AiSession>,
    app: AppHandle,
}

pub struct AiSession {
    pub id: String,
    pub adapter: Box<dyn BackendAdapter>,
    pub event_buffer: EventBuffer,
    pub phase: SessionPhase,
    pub config: SessionConfig,
}

// Commandes Tauri
#[tauri::command]
fn ai_start_session(app: AppHandle, provider: String, config: SessionConfig) -> Result<String, String>
// Cree l'adapter selon le provider, demarre la session

#[tauri::command]
fn ai_send_message(session_id: String, content: String) -> Result<(), String>
// Delegue a adapter.send_message()

#[tauri::command]
fn ai_respond_permission(session_id: String, request_id: String, allowed: bool) -> Result<(), String>
// Delegue a adapter.respond_permission()

#[tauri::command]
fn ai_interrupt(session_id: String) -> Result<(), String>
// Delegue a adapter.interrupt()

#[tauri::command]
fn ai_stop_session(session_id: String) -> Result<(), String>
// Delegue a adapter.stop()

#[tauri::command]
fn ai_list_providers() -> Vec<ProviderInfo>
// Liste les providers disponibles (detecte claude dans PATH, config API existante, etc.)

#[tauri::command]
fn ai_get_capabilities(provider: String) -> AdapterCapabilities
// Retourne les capabilities d'un provider
```

**Tests** :
- Trait BackendAdapter mocke
- Session lifecycle (start → message → response → stop)
- Event buffer overflow
- Deduplication

---

### Phase 2 — Adapter Claude Code CLI

**Creer** : `src-tauri/src/ai/adapters/claude_cli.rs`

- Spawn `claude` CLI avec NDJSON
- Parse stdout ligne par ligne
- Mappe vers `AdapterEvent`
- Deduplication par hash rolling

**Prerequis** : `claude` installe et authentifie

**Tests** :
- NDJSON parsing (valide, malformed, vide)
- Mapping de chaque type de message
- Deduplication

---

### Phase 3 — Adapter HTTP API generique

**Creer** : `src-tauri/src/ai/adapters/http_api.rs`

- Support Anthropic (`/v1/messages`), OpenAI (`/v1/chat/completions`), Ollama (`/api/chat`)
- Streaming SSE/NDJSON → `AdapterEvent`
- Gestion de l'historique conversation (messages array)
- Pas de tool-calling pour l'instant (juste chat)

**Config** :
```rust
pub struct HttpApiConfig {
    pub provider: ApiProvider,     // Anthropic | OpenAI | Ollama | LmStudio
    pub base_url: String,
    pub api_key: Option<String>,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
}
```

**Reutilise** la config LLM existante en DB (`llm_configs` table).

**Tests** :
- Parsing SSE Anthropic
- Parsing SSE OpenAI
- Parsing NDJSON Ollama
- Historique conversation

---

### Phase 4 — Frontend Store AI (SolidJS, provider-agnostic)

**Creer** : `apps/desktop/src/application/stores/aiSessionStore.ts`

```typescript
interface AiMessage {
  id: string;
  seq: number;
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result" | "permission_request" | "error";
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  permissionRequest?: { requestId: string; toolName: string; toolInput: unknown; description: string };
  isStreaming?: boolean;
  streamPhase?: "thinking" | "text";
  timestamp: number;
}

interface AiSession {
  id: string;
  provider: string;           // "claude-cli" | "codex-cli" | "anthropic-api" | "openai-api" | "ollama" | ...
  capabilities: AdapterCapabilities;
  phase: "connecting" | "ready" | "terminated";
  model: string;
  messages: AiMessage[];
  pendingPermissions: Map<string, PermissionRequest>;
  isStreaming: boolean;
  streamingContent: string;
}

// Le store ne connait pas le provider — il traite les AdapterEvents generiques
listen("ai-event", (event) => {
  const { sessionId, event: adapterEvent } = event.payload;
  switch (adapterEvent.type) {
    case "StreamToken": // accumulate streaming content
    case "AssistantMessage": // add to messages
    case "ToolUse": // add tool block
    case "PermissionRequest": // show permission banner
    case "TurnComplete": // finalize
    // ... tous les AdapterEvent
  }
});
```

---

### Phase 5 — Chat Panel AI (remplace AiAssistant)

**Creer** : `apps/desktop/src/ui/components/ide/AiChat.tsx`

Le panel est **identique quel que soit le provider**. Il affiche :
- Messages (user/assistant/system)
- Streaming avec curseur clignotant
- Tool blocks (si `capabilities.supports_tools`)
- Permission banners (si `capabilities.supports_permissions`)
- Indicateur de provider en haut (ex: "Claude Code CLI" ou "Ollama llama3.2")

**Composants** :
- `AiChat.tsx` — panel principal
- `AiMessage.tsx` — rendu message (markdown + tool blocks)
- `ToolBlock.tsx` — affichage tool_use collapsible
- `PermissionBanner.tsx` — approbation avec diff preview
- `ProviderPicker.tsx` — selecteur de provider dans le header

**Adaptation selon capabilities** :
```tsx
<Show when={session.capabilities.supports_tools}>
  <ToolBlock ... />
</Show>

<Show when={session.capabilities.supports_permissions}>
  <PermissionBanner ... />
</Show>

<Show when={!session.capabilities.supports_file_access}>
  {/* Injecter automatiquement le fichier actif dans le message */}
</Show>
```

**Boutons contextuels adaptes** :
- Si `file_access=true` (CLI) : "Refactorise ce fichier" → Claude lit/ecrit directement
- Si `file_access=false` (API) : "Refactorise ce code" → envoie le code dans le message, montre le resultat

---

### Phase 6 — PTY Terminal

Meme plan qu'avant — `portable-pty` en Rust, xterm.js en frontend. Independant du provider AI.

**Creer** : `src-tauri/src/pty.rs`

---

### Phase 7 — Integration editeur + diff

**Context menu Monaco** adapte au provider :

```typescript
// Si le provider a file_access (CLI)
editor.addAction({
  id: "ai.refactor-project",
  label: "IA: Refactorer (avec acces projet)",
  run: () => sendMessage(`Refactorise ce code et ecris les changements: ...`)
});

// Toujours disponible (tous providers)
editor.addAction({
  id: "ai.explain",
  label: "IA: Expliquer",
  run: () => {
    const code = getSelection();
    if (capabilities.supports_file_access) {
      sendMessage(`Explique le fichier ${fileName}`);  // Claude lit le fichier lui-meme
    } else {
      sendMessage(`Explique ce code:\n\`\`\`\n${code}\n\`\`\``);  // On envoie le code
    }
  }
});
```

**Diff preview** : quand un CLI adapter emet `PermissionRequest` pour ecrire un fichier → Monaco diff editor (original vs modifie).

---

### Phase 8 — Git ameliore + nettoyage

- Branches, push/pull dans GitPanel
- Supprimer `AiAssistant.tsx`, `code.routes.ts`, `code.tools.ts`
- Persistence onglets (localStorage)
- File watching
- Documentation

---

## Resume des phases

| Phase | Contenu | Fichiers | Effort |
|-------|---------|----------|--------|
| **1** | Interface commune + Session Manager (Rust) | `ai/mod.rs`, `types.rs`, `adapter.rs`, `session_manager.rs`, `dedup.rs`, `event_buffer.rs` | Moyen |
| **2** | Adapter Claude Code CLI | `ai/adapters/claude_cli.rs` | Moyen |
| **3** | Adapter HTTP API (Anthropic/OpenAI/Ollama) | `ai/adapters/http_api.rs` | Moyen |
| **4** | Store AI frontend (provider-agnostic) | `aiSessionStore.ts` | Faible |
| **5** | Chat Panel AI + ProviderPicker | `AiChat.tsx`, `AiMessage.tsx`, `ToolBlock.tsx`, `PermissionBanner.tsx`, `ProviderPicker.tsx` | Moyen |
| **6** | PTY Terminal | `pty.rs`, modifier `Terminal.tsx` | Moyen |
| **7** | Integration editeur + diff | `DiffPreview.tsx`, modifier `MonacoEditor.tsx` | Faible |
| **8** | Git + nettoyage + docs | Etendre git.rs, supprimer dead code | Faible |

---

## Matrice providers × features

| Feature | Claude CLI | Codex CLI | Anthropic API | OpenAI API | Ollama | LM Studio |
|---------|-----------|-----------|--------------|-----------|--------|-----------|
| Chat streaming | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool-calling visible | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Permissions UI | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Acces fichiers projet | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Execution terminal | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Images dans le chat | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Thinking/raisonnement | ✓ | ✗ | ✓ | ✓ (o1) | ✗ | ✗ |
| Cout gratuit | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

> Le frontend s'adapte automatiquement grace a `capabilities`. Pas de if/else par provider dans l'UI.

---

## Prerequis par provider

| Provider | Prerequis |
|----------|-----------|
| Claude Code CLI | `claude` dans PATH + `claude auth` configure |
| Codex CLI | `codex` dans PATH + API key OpenAI |
| Anthropic API | Cle API dans la config LLM existante |
| OpenAI API | Cle API dans la config LLM existante |
| Ollama | Container Ollama running (deja supporte par Magick Cookie) |
| LM Studio | LM Studio running (deja supporte) |

---

## Ce qu'on prend de Companion

| Concept | Source Companion | Adaptation Magick Cookie |
|---------|-----------------|-------------------------|
| `IBackendAdapter` interface | `backend-adapter.ts` | Trait Rust `BackendAdapter` |
| NDJSON parsing + dedup | `ws-bridge-cli-ingest.ts` | Module Rust `dedup.rs` |
| Event buffer circulaire | `ws-bridge.ts` (eventBuffer) | Module Rust `event_buffer.rs` |
| Session state machine | `session-state-machine.ts` | 3 etats dans `session_manager.rs` |
| Permission request/response | `PermissionBanner.tsx` | Composant SolidJS `PermissionBanner.tsx` |
| Tool block visualization | `ToolBlock` dans `MessageBubble.tsx` | Composant SolidJS `ToolBlock.tsx` |
| Message types protocol | `session-types.ts` | `types.rs` (AdapterEvent enum) |

## Ce qu'on NE prend PAS

| Element | Raison |
|---------|--------|
| WebSocket server | Tauri IPC direct |
| Multi-browser support | App desktop single user |
| Session JSONL persistence | localStorage suffit |
| Container manager | Hors scope IDE |
| Relay/Platform | SaaS cloud, pas pertinent |
| Recording/audit | Pas necessaire |
| Linear integration | On a notre propre systeme |
