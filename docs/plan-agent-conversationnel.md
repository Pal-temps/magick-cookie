# Plan — Agent conversationnel Magick Cookie

Inspire par OpenClaw, mais scope a tes donnees de productivite (pas d'acces systeme complet).
Aucune dependance a des services tiers — tout est heberge par toi.

## Concept

Un agent IA qui connait **toutes tes donnees Magick Cookie** et avec qui tu peux interagir par :
1. Le chat integre dans l'app desktop (deja existant, enrichi avec tool-calling)
2. Des actions proactives (l'agent te notifie via push queue)
3. A terme, une app mobile legere (voir `docs/mobile/agent-chat-mobile.md`)

L'agent ne controle pas ton PC — il a acces a tes donnees de productivite et peut agir dessus.

---

## Etat d'implementation

| Phase | Statut | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Agent Core — tool-calling dans le chat |
| 2 | ✅ Done | Scheduler + Push Queue — notifications proactives |
| 3 | ❌ A faire | App mobile (voir `docs/mobile/agent-chat-mobile.md`) |
| 4 | ✅ Done | Memoire contextuelle |

---

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
| "Combien de temps sur le projet X ?" | analytics/time-by-project |
| "Mes patterns de productivite ?" | analytics/patterns |
| "Mes serveurs vont bien ?" | vps/health |

### Agir (commandes en langage naturel)

| Commande | Action API |
|----------|------------|
| "Commence un pomodoro sur le projet API" | POST /timer-sessions (start) |
| "Ajoute un bookmark github.com/openclaw" | POST /bookmarks |
| "Trie cette tache en prioritaire" | POST /triage |
| "Cree un event demain 14h reunion equipe" | POST /events |
| "Note rapide: idee de refacto du store" | POST /tasks (quick capture) |
| "Ajoute le projet Magick Cookie en bleu" | POST /projects |
| "Sync mes emails" | POST /email-accounts/:id/sync |
| "Genere mon brief" | POST /brief/generate |

### Proactif (notifications push)

| Trigger | Notification |
|---------|-------------|
| 8h du matin (lun-ven) | Brief du jour |
| Dimanche 19h | Weekly review |
| 17h sans focus (lun-ven) | Streak en danger |
| Inbox > 20 non lus | Alerte inbox |

---

## Architecture technique

### Phase 1 — Agent Core (✅ Done)

**Fichiers crees :**
- `apps/api/src/application/agent/agent.service.ts` — orchestrateur avec boucle tool-calling (max 5 rounds)
- `apps/api/src/application/agent/tool-registry.ts` — registre extensible
- `apps/api/src/application/agent/tools/analytics.tools.ts` — 6 tools (overview, streak, patterns, time-by-project, today, weekly review)
- `apps/api/src/application/agent/tools/task.tools.ts` — 5 tools (list, priority, triage by status, set triage, create)
- `apps/api/src/application/agent/tools/timer.tools.ts` — 3 tools (today stats, sessions, save)
- `apps/api/src/application/agent/tools/brief.tools.ts` — 7 tools (brief, email count, sync, events, bookmarks, projects)
- `apps/api/src/presentation/routes/agent.routes.ts` — CRUD conversations + POST message

**Endpoint :** `POST /api/agent/:id/messages { message: string }`

**Approche :** Prompt engineering avec blocs ` ```TOOL_CALL ``` ` — compatible tous LLM (Ollama, LM Studio, OpenAI). Pas besoin de support natif function calling.

**Desktop :** `chatStore.ts` redirige vers `/api/agent` au lieu de `/api/chat`.

### Phase 2 — Scheduler + Push Queue (✅ Done)

**Fichiers crees :**
- `apps/api/src/domain/push/push-notification.entity.ts`
- `apps/api/src/domain/push/push-notification.repository.ts`
- `apps/api/src/infrastructure/repositories/push-notification.repository.impl.ts`
- `apps/api/src/infrastructure/jobs/agent-scheduler.ts` — 4 jobs (brief, review, streak, inbox)
- `apps/api/src/presentation/routes/push.routes.ts` — GET/POST + SSE stream
- `apps/api/drizzle/0015_push_notifications.sql`

**Endpoints :**
- `GET /api/push/pending` — non lues
- `GET /api/push?limit=50` — toutes
- `POST /api/push/:id/read` — marquer lue
- `POST /api/push/read-all` — tout marquer lu
- `GET /api/push/stream` — SSE temps reel

**Scheduler :** Interval 15 min, chaque job verifie l'heure + jour + "deja envoye aujourd'hui". Cleanup auto 30j.

### Phase 4 — Memoire contextuelle (✅ Done)

L'agent maintient un "profil de travail" :
- Faits permanents (ex: "utilisateur est dev backend")
- Preferences permanentes (ex: "prefere les briefs courts")
- Contexte temporaire expire 24h (ex: "ce matin travaille sur le refacto auth")

**Fichiers crees :**
- `apps/api/src/domain/agent-memory/agent-memory.entity.ts` — types `fact`, `context`, `preference`
- `apps/api/src/domain/agent-memory/agent-memory.repository.ts` — interface du repo
- `apps/api/src/infrastructure/repositories/agent-memory.repository.impl.ts` — implementation Drizzle
- `apps/api/src/infrastructure/database/schema.ts` — table `agent_memory`
- `apps/api/drizzle/0017_agent_memory.sql` — migration
- `apps/api/src/application/agent/tools/memory.tools.ts` — 3 tools : `save_memory`, `get_memories`, `delete_memory`

**Integration :**
- `agent.service.ts` : `buildSystemPromptAsync()` injecte les memoires actives (facts, preferences, contexte) dans le system prompt
- `agent-scheduler.ts` : cleanup horaire des memoires `context` expirees

---

## Differences avec OpenClaw

| Aspect | OpenClaw | Magick Cookie Agent |
|--------|----------|---------------------|
| Scope | Acces complet au systeme | Donnees de productivite uniquement |
| Canaux | 24+ services tiers | Chat desktop + push locale (zero tiers) |
| Notifications | Via messagerie tierce | Push queue locale + SSE |
| Modele IA | Claude/GPT/local | LLM local (Ollama) par defaut, Anthropic/OpenAI-compatible en option |
| Donnees | Transitent par des tiers | Restent sur ton reseau local |
