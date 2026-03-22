# Integration LLM

> Statut : **Done** — 4 providers (Ollama, LM Studio, OpenAI-compatible, Anthropic), streaming SSE, auto-setup Ollama.

Architecture generique pour connecter un LLM local ou cloud. Sert de fondation pour toutes les features IA (brief, digest, chat, triage, classification, events).

## Architecture

```
api/src/
├── domain/llm/
│   ├── llm.entity.ts                  # LlmConfig, LlmProvider, ChatMessage, ChatResponse
│   └── llm.port.ts                    # interface LlmPort { chat(), chatStream(), summarize(), classify() }
├── application/llm/
│   └── llm.service.ts                 # Orchestration, retry, fallback
├── infrastructure/
│   ├── adapters/
│   │   ├── ollama.adapter.ts          # Ollama REST API (chat + stream)
│   │   ├── lmstudio.adapter.ts        # LM Studio (OpenAI-compatible)
│   │   ├── openai.adapter.ts          # OpenAI-compatible (chat + stream)
│   │   └── anthropic.adapter.ts       # Anthropic Messages API (system top-level)
│   └── repositories/
│       └── llm-config.repository.impl.ts

desktop/src/
└── ui/components/llm/
    └── LlmSettings.tsx                # Config UI : provider, URL, modele, test
```

## Configuration (stockee en DB)

```typescript
interface LlmConfig {
  id: string;
  provider: "ollama" | "lmstudio" | "openai-compatible" | "anthropic";
  baseUrl: string;           // ex: http://localhost:11434
  model: string;             // ex: llama3.2:3b, mistral:7b
  apiKey: string | null;     // null pour Ollama local
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}
```

## Providers

| Provider | API | URL par defaut |
|----------|-----|----------------|
| Ollama | `POST /api/chat` | `http://localhost:11434` |
| LM Studio | OpenAI-compatible `/v1/chat/completions` | `http://localhost:1234` |
| OpenAI-compatible | Idem LM Studio | Configurable |
| Anthropic | `POST /v1/messages` (system top-level) | `https://api.anthropic.com` |

## API

```
GET    /api/llm/config               # Config actuelle
PUT    /api/llm/config               # Modifier la config
POST   /api/llm/test                 # Tester la connexion
POST   /api/llm/chat                 # Prompt generique
POST   /api/llm/summarize            # Resumer un texte
POST   /api/llm/generate-events      # Generer events calendrier
POST   /api/llm/auto-setup           # Auto-detecte Ollama + meilleur modele
```

## Fonctionnalites

### Streaming SSE
- `LlmPort.chatStream()` → `AsyncIterable<string>`
- Les 4 adapters implementent le streaming
- Route SSE `POST /api/agent/:id/messages/stream`

### Auto-setup Ollama
- Detecte le container Docker Ollama
- Choisit le meilleur modele disponible
- Configure automatiquement la connexion

### AiButton (gating UI)
- Composant reutilisable qui grise les boutons IA si pas de LLM configure
- Click quand desactive → redirige vers Settings > IA
- Signal global `isLlmConfigured()` charge au boot
- Applique sur : email resume, email rapport, event generator, auto-triage, journal, changelog, RSS digest

### AI Activity Indicator
- Track toutes les operations LLM en temps reel
- Cookie loader gif pendant les operations

### JSON mode
- Force JSON mode pour les outputs structures (RSS digest, events)
- Extraction JSON depuis reponses markdown-wrapped

## Usages dans l'app

| Feature | Methode LLM | Description |
|---------|------------|-------------|
| Brief quotidien | `chat()` | Resume hier/aujourd'hui/blocages |
| Email resume | `summarize()` | Resume 2-3 phrases |
| Email classification | `classify()` | newsletter, facture, action_requise... |
| RSS digest | `generateRssDigest()` | Triage + resume quotidien |
| Chat | `chat()` / `chatStream()` | Conversation libre |
| Agent | `chat()` / `chatStream()` | Tool-calling sur les donnees |
| Auto-triage | `classify()` | Suggestion triage taches |
| Events IA | `generateEvents()` | Creation events depuis description |
| Changelog | `chat()` | Resume commits git |
| Weekly review | `generateNarrative()` | Resume narratif hebdo |
| IDE: Explain | `chat()` | Explication de code |
| IDE: Refactor | `chat()` | Refactoring de code |
| IDE: Generate | `chat()` | Generation de code |
| IDE: Fix | `chat()` | Correction de bugs |
| IDE: Tests | `chat()` | Generation de tests |
| IDE: Document | `chat()` | Ajout de documentation |
