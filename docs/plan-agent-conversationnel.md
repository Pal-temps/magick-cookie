# Plan — Agent conversationnel Magick Cookie

Inspire par OpenClaw, mais scope a tes donnees de productivite (pas d'acces systeme complet).

## Concept

Un agent IA qui connait **toutes tes donnees Magick Cookie** et avec qui tu peux interagir par :
1. Le chat integre dans l'app (deja existant)
2. Telegram / Discord (acces mobile, hors de l'app)
3. Des actions proactives (l'agent te contacte)

L'agent ne controle pas ton PC — il a acces a tes donnees de productivite et peut agir dessus.

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
| "Archive cet email" | PATCH /emails/:id |
| "Cree un event demain 14h reunion equipe" | POST /events |
| "Note rapide: idee de refacto du store" | POST /tasks (quick capture) |
| "Ajoute le projet Magick Cookie en bleu" | POST /projects |
| "Sync mes emails" | POST /email-accounts/:id/sync |
| "Genere mon brief" | POST /brief/generate |
| "Lance la balade du chien" | POST /dog-walks/start |

### Proactif (l'agent te contacte)

| Trigger | Message |
|---------|---------|
| 8h du matin | Brief du jour envoye sur Telegram |
| Dimanche soir | Weekly review de la semaine |
| Pas de focus depuis 3h (jour ouvre) | "Tu veux lancer un pomodoro ?" |
| Tache en priority depuis 5 jours | "La tache X stagne, on en fait quoi ?" |
| PR mergee/commentee | Notif GitHub sur Telegram |
| Inbox > 20 non lus | "Tu as 23 emails non lus, digest ?" |
| Fin d'un pomodoro | "Session terminee ! Note de session ?" |
| Streak a risque (pas de focus aujourd'hui) | "Ton streak de 12 jours est en danger !" |

---

## Architecture

```
                    ┌──────────────┐
                    │  Telegram    │
                    │  Discord     │
                    │  (canaux)    │
                    └──────┬───────┘
                           │ webhook / polling
                           v
┌─────────────────────────────────────────────┐
│              apps/agent                      │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Channel      │  │ Agent Core           │  │
│  │ Adapters     │──│                      │  │
│  │ - Telegram   │  │ 1. Parse intent      │  │
│  │ - Discord    │  │ 2. Call API interne   │  │
│  │ - Internal   │  │ 3. Format reponse    │  │
│  └─────────────┘  │ 4. Envoyer           │  │
│                    └──────────┬───────────┘  │
│                               │              │
│  ┌─────────────┐  ┌──────────┴───────────┐  │
│  │ Scheduler    │  │ Tool Registry        │  │
│  │ (cron-like)  │  │ (fonctions dispo)    │  │
│  │ - brief 8h   │  │ - read_analytics     │  │
│  │ - review dim │  │ - create_task        │  │
│  │ - nudges     │  │ - manage_email       │  │
│  └─────────────┘  │ - control_timer      │  │
│                    │ - ...                │  │
│                    └─────────────────────┘  │
└──────────────────────┬──────────────────────┘
                       │ HTTP (localhost)
                       v
              ┌──────────────────┐
              │   apps/api       │
              │  (API existante) │
              └──────────────────┘
```

### Principe cle : l'agent appelle l'API existante

L'agent n'accede PAS directement a la DB. Il utilise les memes endpoints REST que le frontend desktop. Ca veut dire :
- Zero modification backend pour les features existantes
- L'agent a exactement les memes capacites que l'UI
- Facile a tester (mock l'API)
- Securise par design (pas d'escalade de privileges)

---

## Implementation

### Phase 1 — Agent Core + Chat interne enrichi

**Objectif :** Le chat existant devient intelligent — il comprend tes donnees.

Actuellement le chat LLM est "bete" : il envoie tes messages au LLM sans contexte.
On le transforme en **agent avec tools** : le LLM peut appeler les endpoints API.

**Approche : Function calling / Tool use**

```typescript
// Tool definition pour le LLM
const AGENT_TOOLS = [
  {
    name: "get_analytics",
    description: "Recupere les stats de productivite (focus, triage, wellness, email, events)",
    parameters: { from: "date", to: "date" },
    execute: (params) => api.get(`/analytics?from=${params.from}&to=${params.to}`),
  },
  {
    name: "get_priority_tasks",
    description: "Liste les taches marquees comme prioritaires",
    execute: () => api.get("/triage?status=priority"),
  },
  {
    name: "create_task",
    description: "Cree une nouvelle tache",
    parameters: { title: "string", source: "string" },
    execute: (params) => api.post("/tasks", params),
  },
  {
    name: "start_pomodoro",
    description: "Demarre un timer pomodoro",
    parameters: { projectId: "string?", taskId: "string?" },
    execute: (params) => api.post("/timer-sessions/start", params),
  },
  // ... 20+ tools couvrant toute l'API
];
```

**Le flow :**
1. User : "Combien de temps j'ai bosse cette semaine ?"
2. Agent envoie au LLM avec les tools disponibles
3. LLM decide d'appeler `get_analytics` avec `from=lundi, to=aujourd'hui`
4. Agent execute l'appel API, recupere les donnees
5. Agent renvoie les donnees au LLM
6. LLM formule une reponse : "Cette semaine tu as 12h30 de focus, 28 pomodoros..."

**Fichiers :**

| Action | Fichier |
|--------|---------|
| Creer | `apps/agent/src/core/agent.ts` — orchestrateur principal |
| Creer | `apps/agent/src/core/tool-registry.ts` — registre des tools |
| Creer | `apps/agent/src/tools/*.ts` — un fichier par domaine (analytics, tasks, timer, email...) |
| Creer | `apps/agent/src/core/api-client.ts` — client HTTP vers l'API locale |
| Modifier | `apps/api/src/application/chat/chat.service.ts` — integrer le tool-calling |
| Modifier | `apps/desktop/src/ui/components/chat/ChatView.tsx` — afficher les actions executees |

**Valeur :** Le chat dans l'app devient un vrai assistant qui peut repondre a des questions sur tes donnees et executer des actions.

---

### Phase 2 — Connecteur Telegram

**Objectif :** Interagir avec Magick Cookie depuis ton telephone via Telegram.

**Pourquoi Telegram ?**
- API bot simple et gratuite
- Pas besoin de numero WhatsApp business
- Markdown supporte nativement
- Pas de rate limiting agressif
- Un seul user (toi) donc pas de gestion multi-tenant

**Architecture :**
- Bot Telegram en long-polling (pas besoin de webhook/domaine public)
- Le bot tourne dans `apps/agent` a cote de l'API
- Securise par ton chat_id Telegram (seul toi peux parler au bot)

```typescript
// apps/agent/src/channels/telegram.ts
import TelegramBot from "node-telegram-bot-api";

export class TelegramChannel {
  private bot: TelegramBot;

  constructor(
    private token: string,
    private allowedChatId: string,
    private agent: AgentCore,
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on("message", (msg) => this.handleMessage(msg));
  }

  private async handleMessage(msg: TelegramBot.Message) {
    if (String(msg.chat.id) !== this.allowedChatId) return; // securite

    const response = await this.agent.process(msg.text ?? "");
    await this.bot.sendMessage(msg.chat.id, response, { parse_mode: "Markdown" });
  }

  async sendProactive(text: string) {
    await this.bot.sendMessage(this.allowedChatId, text, { parse_mode: "Markdown" });
  }
}
```

**Config :**
- `TELEGRAM_BOT_TOKEN` — token du bot (@BotFather)
- `TELEGRAM_CHAT_ID` — ton chat_id personnel

**Fichiers :**

| Action | Fichier |
|--------|---------|
| Creer | `apps/agent/src/channels/telegram.ts` — adaptateur Telegram |
| Creer | `apps/agent/src/channels/channel.interface.ts` — interface commune |
| Modifier | `apps/agent/src/index.ts` — demarrer le bot Telegram |
| Ajouter | Dependance `node-telegram-bot-api` |

**Valeur :** Tu peux demander ton brief, checker tes taches, ajouter des notes depuis ton telephone sans ouvrir l'app.

---

### Phase 3 — Actions proactives (Scheduler)

**Objectif :** L'agent te contacte de lui-meme quand c'est pertinent.

**Implementation :**
- Scheduler cron-like dans `apps/agent`
- Chaque job verifie une condition et envoie un message si necessaire
- Utilise les canaux configures (Telegram, et/ou notification desktop)

```typescript
// apps/agent/src/scheduler/jobs.ts
export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: "morning-brief",
    cron: "0 8 * * 1-5",  // Lundi-vendredi 8h
    execute: async (agent, channels) => {
      const brief = await agent.callTool("generate_brief", {});
      channels.broadcast(`## Brief du jour\n\n${brief}`);
    },
  },
  {
    name: "weekly-review",
    cron: "0 19 * * 0",   // Dimanche 19h
    execute: async (agent, channels) => {
      const review = await agent.callTool("get_weekly_review", { week: currentISOWeek() });
      channels.broadcast(formatWeeklyReview(review));
    },
  },
  {
    name: "streak-nudge",
    cron: "0 17 * * 1-5",  // 17h jours ouvres
    execute: async (agent, channels) => {
      const streak = await agent.callTool("get_streak", {});
      const today = await agent.callTool("get_analytics", { from: today(), to: today() });
      if (streak.currentStreak > 0 && today.focus.totalSeconds === 0) {
        channels.broadcast(`Ton streak de ${streak.currentStreak} jours est en danger ! Lance un pomodoro ?`);
      }
    },
  },
  {
    name: "inbox-alert",
    cron: "0 */2 * * *",   // Toutes les 2h
    execute: async (agent, channels) => {
      const count = await agent.callTool("get_unread_count", {});
      if (count > 20) {
        channels.broadcast(`Tu as ${count} emails non lus. Digest ?`);
      }
    },
  },
];
```

**Fichiers :**

| Action | Fichier |
|--------|---------|
| Creer | `apps/agent/src/scheduler/scheduler.ts` — moteur cron |
| Creer | `apps/agent/src/scheduler/jobs.ts` — definition des jobs |
| Creer | `apps/agent/src/channels/broadcast.ts` — envoyer sur tous les canaux |

**Valeur :** L'app devient proactive — elle ne se contente plus d'attendre que tu l'ouvres.

---

### Phase 4 — Memoire contextuelle

**Objectif :** L'agent se souvient du contexte entre les conversations.

**Pas une simple historique de chat.** L'agent maintient un "profil de travail" :
- Tes horaires de travail habituels (deduits des patterns)
- Tes projets actifs et leur priorite
- Tes preferences ("je prefere les briefs courts", "notifie-moi que pour les PR urgentes")
- Le contexte recent ("ce matin tu m'as dit que tu bossais sur le refacto auth")

**Implementation :**
- Table `agent_memory` : `{ id, type, content, createdAt, expiresAt }`
- Types : `fact` (permanent), `context` (expire apres 24h), `preference` (permanent, modifiable)
- Le LLM recoit le contexte pertinent dans son system prompt
- L'agent extrait automatiquement les faits importants des conversations

```typescript
// System prompt enrichi
const systemPrompt = `
Tu es l'assistant Magick Cookie de ${userName}.
${await memoryStore.getRelevantContext()}

Profil de travail :
- Heures les plus productives : ${patterns.bestHours.join("h, ")}h
- Jours les plus focuses : ${patterns.bestDays.join(", ")}
- Streak actuel : ${streak.currentStreak} jours
- Projets actifs : ${projects.map(p => p.name).join(", ")}

Preferences :
${preferences.map(p => `- ${p.content}`).join("\n")}
`;
```

**Fichiers :**

| Action | Fichier |
|--------|---------|
| Creer | Migration `agent_memory` table |
| Creer | `apps/agent/src/memory/memory.service.ts` |
| Creer | `apps/agent/src/memory/context-builder.ts` — construit le prompt enrichi |
| Modifier | `apps/agent/src/core/agent.ts` — injecter le contexte |

---

### Phase 5 — Connecteur Discord (optionnel)

Meme pattern que Telegram, avec `discord.js`. Utile si tu es deja sur un serveur Discord.

---

## Structure du dossier apps/agent

```
apps/agent/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Point d'entree, demarre agent + channels + scheduler
│   ├── core/
│   │   ├── agent.ts                # Orchestrateur principal (LLM + tools)
│   │   ├── tool-registry.ts        # Registre des tools disponibles
│   │   └── api-client.ts           # Client HTTP vers l'API locale
│   ├── tools/
│   │   ├── analytics.tools.ts      # get_analytics, get_streak, get_patterns...
│   │   ├── timer.tools.ts          # start_pomodoro, stop_timer...
│   │   ├── task.tools.ts           # get_tasks, create_task, triage...
│   │   ├── email.tools.ts          # get_emails, summarize, sync...
│   │   ├── calendar.tools.ts       # get_events, create_event...
│   │   ├── brief.tools.ts          # generate_brief, get_weekly_review...
│   │   ├── bookmark.tools.ts       # create_bookmark, list_bookmarks...
│   │   ├── project.tools.ts        # list_projects, create_project...
│   │   └── vps.tools.ts            # get_health, get_alerts...
│   ├── channels/
│   │   ├── channel.interface.ts    # Interface commune
│   │   ├── telegram.ts             # Bot Telegram
│   │   ├── discord.ts              # Bot Discord (phase 5)
│   │   └── broadcast.ts            # Envoyer sur tous les canaux
│   ├── scheduler/
│   │   ├── scheduler.ts            # Moteur cron (node-cron)
│   │   └── jobs.ts                 # Definitions des jobs proactifs
│   └── memory/
│       ├── memory.service.ts       # CRUD memoire agent
│       └── context-builder.ts      # Construit le system prompt enrichi
```

## Dependances

```json
{
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0",
    "node-cron": "^3.0.3",
    "discord.js": "^14.16.0"
  }
}
```

## Ordre d'implementation

```
Phase 1 — Agent Core + Chat intelligent        (priorite haute, fondation)
Phase 2 — Connecteur Telegram                   (valeur immediate, acces mobile)
Phase 3 — Actions proactives                    (game changer, l'app vient a toi)
Phase 4 — Memoire contextuelle                  (polish, personnalisation)
Phase 5 — Discord                               (optionnel, si besoin)
```

## Differences avec OpenClaw

| Aspect | OpenClaw | Magick Cookie Agent |
|--------|----------|---------------------|
| Scope | Acces complet au systeme (fichiers, shell, navigateur) | Acces aux donnees de productivite uniquement (via API) |
| Securite | Sandbox + permissions granulaires | Pas de sandbox necessaire (API REST = safe by design) |
| Multi-user | Support multi-tenant, pairing | Single-user (toi), chat_id verification |
| Canaux | 24+ (WhatsApp, Signal, Matrix...) | 2-3 (chat interne, Telegram, Discord) |
| Skills | Marketplace communautaire (ClawHub) | Tools fixes lies a l'API Magick Cookie |
| Complexite | Elevee (Gateway WebSocket, RPC, device nodes) | Faible (HTTP client + LLM + polling bot) |
| Modele IA | Claude/GPT/local | Reutilise le LLM deja configure dans l'app |

## Notes

- **Pas de gateway WebSocket complexe** — on reutilise l'API HTTP existante, c'est suffisant.
- **LLM : privilegier le tool-calling natif** — Ollama et les providers OpenAI-compatible supportent les function calls. Sinon, fallback sur du prompt engineering avec format JSON.
- **Single process** — L'agent tourne dans le meme process que l'API (ou en sidecar). Pas besoin d'une archi distribuee pour un usage personnel.
- **Le chat desktop existant devient le premier "canal"** — Pas besoin de refactorer, juste d'enrichir le ChatService avec le tool-calling.
