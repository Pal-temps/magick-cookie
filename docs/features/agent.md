# Agent conversationnel

> Statut : **Done** — Agent Core (tool-calling), Scheduler + Push Queue, Memoire contextuelle. Reste : app mobile (voir `mobile/agent-chat-mobile.md`).

Agent IA qui connait toutes les donnees Magick Cookie. Interactions via le chat integre, actions proactives via push queue. Zero dependance tiers — tout est local.

## Ce que l'agent peut faire

### Lire (questions en langage naturel)

| Question | Donnees utilisees |
|----------|-------------------|
| "Combien de temps j'ai bosse cette semaine ?" | timer_sessions, analytics |
| "C'est quoi mes taches prioritaires ?" | triage + tasks |
| "Resume mes emails non lus" | emails + LLM |
| "Qu'est-ce que j'ai fait hier ?" | brief (rawData) |
| "Montre mon streak" | analytics/streak |
| "J'ai des PRs a review ?" | github PRs |
| "C'est quoi mon prochain event ?" | events |
| "Mes serveurs vont bien ?" | vps/health |

### Agir (commandes en langage naturel)

| Commande | Action API |
|----------|------------|
| "Commence un pomodoro sur le projet API" | POST /timer-sessions (start) |
| "Ajoute un bookmark github.com/..." | POST /bookmarks |
| "Cree un event demain 14h reunion equipe" | POST /events |
| "Note rapide: idee de refacto" | POST /tasks (quick capture) |
| "Sync mes emails" | POST /email-accounts/:id/sync |
| "Genere mon brief" | POST /brief/generate |

### Proactif (push notifications)

| Trigger | Notification |
|---------|-------------|
| 8h du matin (lun-ven) | Brief du jour |
| Dimanche 19h | Weekly review |
| 17h sans focus (lun-ven) | Streak en danger |
| Inbox > 20 non lus | Alerte inbox |

## Architecture

```
api/src/
├── application/agent/
│   ├── agent.service.ts              # Orchestrateur — boucle tool-calling (max 5 rounds)
│   ├── tool-registry.ts              # Registre extensible de tools
│   └── tools/
│       ├── analytics.tools.ts        # 6 tools (overview, streak, patterns, time-by-project, today, weekly)
│       ├── task.tools.ts             # 5 tools (list, priority, triage by status, set triage, create)
│       ├── timer.tools.ts            # 3 tools (today stats, sessions, save)
│       ├── brief.tools.ts            # 7 tools (brief, email count, sync, events, bookmarks, projects)
│       ├── memory.tools.ts           # 3 tools (save_memory, get_memories, delete_memory)
│       └── code.tools.ts            # 4 tools (list_project_files, read_project_file, write_project_file, search_in_project)
├── domain/agent-memory/
│   ├── agent-memory.entity.ts        # Types: fact, context, preference
│   └── agent-memory.repository.ts
├── domain/push/
│   ├── push-notification.entity.ts
│   └── push-notification.repository.ts
├── infrastructure/
│   ├── repositories/
│   │   ├── agent-memory.repository.impl.ts
│   │   └── push-notification.repository.impl.ts
│   └── jobs/
│       └── agent-scheduler.ts        # 4 jobs (brief, review, streak, inbox)
├── presentation/routes/
│   ├── agent.routes.ts               # CRUD conversations + POST message
│   └── push.routes.ts                # GET/POST push + SSE stream
```

## API

```
# Agent
POST   /api/agent/:id/messages              # Envoyer un message
POST   /api/agent/:id/messages/stream        # Streaming SSE

# Push notifications
GET    /api/push/pending                     # Non lues
GET    /api/push?limit=50                    # Toutes
POST   /api/push/:id/read                    # Marquer lue
POST   /api/push/read-all                    # Tout marquer lu
GET    /api/push/stream                      # SSE temps reel
```

## Approche technique

- **Tool-calling** : blocs ` ```TOOL_CALL ``` ` dans le prompt — compatible tous LLM (Ollama, LM Studio, OpenAI, Anthropic). Pas besoin de support natif function calling.
- **Scheduler** : interval 15 min, chaque job verifie heure + jour + "deja envoye aujourd'hui". Cleanup auto 30j.
- **Memoire** : faits permanents, preferences permanentes, contexte temporaire (expire 24h). Injectee dans le system prompt. Cleanup horaire des contextes expires.

## Differences avec OpenClaw

| Aspect | OpenClaw | Magick Cookie Agent |
|--------|----------|---------------------|
| Scope | Acces complet au systeme | Donnees de productivite uniquement |
| Notifications | Via messagerie tierce | Push queue locale + SSE |
| Modele IA | Claude/GPT/local | LLM local par defaut, cloud en option |
| Donnees | Transitent par des tiers | Restent sur le reseau local |
