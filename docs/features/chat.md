# Chat IA

> Statut : **Done** — Markdown riche, syntax highlighting, streaming SSE, conversations persistantes.

Chat integre connecte au LLM local via l'agent (tool-calling). Remplace Open WebUI.

## Architecture

```
api/src/
├── application/agent/
│   └── agent.service.ts              # sendMessage() + sendMessageStream()
├── presentation/routes/
│   └── agent.routes.ts               # CRUD conversations + messages + SSE

desktop/src/
├── application/stores/chatStore.ts   # Redirige vers /api/agent
└── ui/components/chat/
    └── ChatView.tsx                  # Vue chat
```

## Fonctionnalites

### Streaming SSE
- `POST /api/agent/:id/messages/stream` → Server-Sent Events
- Tools executes en non-stream, reponse finale streamee
- `chatStream()` sur les 4 adapters (Ollama, OpenAI, Anthropic, LM Studio)
- Parseur SSE cote desktop, signal `streamingContent`, curseur clignotant

### Markdown riche
- `marked` + `highlight.js` (theme catppuccin dark)
- Label langue sur les code blocks
- Bouton "Copier" sur chaque code block
- CSS dedie `chat.css`

### Conversations
- CRUD conversations persistantes en DB
- Historique des messages
- Context window via agent service

### Integration agent
- Le chat utilise le meme endpoint que l'agent
- Acces a tous les tools (analytics, tasks, timer, brief, memory...)
- Voir [agent.md](agent.md) pour la liste complete des tools
