# Plan — Agent conversationnel Magick Cookie

Inspire par OpenClaw, mais scope a tes donnees de productivite (pas d'acces systeme complet).
Aucune dependance a des services tiers — tout est heberge par toi.

## Concept

Un agent IA qui connait **toutes tes donnees Magick Cookie** et avec qui tu peux interagir par :
1. Le chat integre dans l'app desktop (deja existant)
2. Une **app mobile legere** (chat + dashboard + notifications push)
3. Des actions proactives (l'agent te contacte via push)

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

### Proactif (l'agent te contacte sur le mobile)

| Trigger | Notification push |
|---------|-------------------|
| 8h du matin | Brief du jour |
| Dimanche soir | Weekly review de la semaine |
| Pas de focus depuis 3h (jour ouvre) | "Tu veux lancer un pomodoro ?" |
| Tache en priority depuis 5 jours | "La tache X stagne, on en fait quoi ?" |
| PR mergee/commentee | Notif GitHub |
| Inbox > 20 non lus | "Tu as 23 emails non lus, digest ?" |
| Fin d'un pomodoro | "Session terminee ! Note de session ?" |
| Streak a risque (pas de focus aujourd'hui) | "Ton streak de 12 jours est en danger !" |

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  apps/desktop       │     │  apps/mobile          │
│  (Tauri + SolidJS)  │     │  (Kotlin Compose)     │
│                     │     │                       │
│  ChatView ←─────────┤     │  ChatView ←───────────┤
│  Dashboard          │     │  Mini Dashboard       │
│                     │     │  Push Notifications   │
└─────────┬───────────┘     └───────────┬───────────┘
          │                             │
          │  HTTP (localhost / LAN)     │ HTTP (LAN / Tailscale)
          v                             v
┌──────────────────────────────────────────────────────┐
│                    apps/api                            │
│                                                        │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ Routes existantes │  │ Agent Service (NOUVEAU)   │  │
│  │ /analytics       │  │                           │  │
│  │ /tasks           │  │ 1. Recoit un message      │  │
│  │ /emails          │  │ 2. Envoie au LLM + tools  │  │
│  │ /timer-sessions  │  │ 3. Execute les tool calls │  │
│  │ /brief           │  │ 4. Retourne la reponse    │  │
│  │ /triage          │  │                           │  │
│  │ /chat            │  └───────────────────────────┘  │
│  │ /bookmarks       │                                  │
│  │ /projects        │  ┌───────────────────────────┐  │
│  │ /vps             │  │ Scheduler (NOUVEAU)       │  │
│  │ /github          │  │ - brief 8h                │  │
│  └──────────────────┘  │ - review dimanche         │  │
│                         │ - nudges (streak, inbox)  │  │
│                         │ → stocke dans push_queue  │  │
│                         └───────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Push Queue (NOUVEAU)                              │  │
│  │ Table DB : { id, title, body, sentAt, readAt }   │  │
│  │ GET /api/push/pending → notifications a afficher │  │
│  │ POST /api/push/:id/read → marquer comme lu       │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
          │
          v
┌──────────────────┐
│   apps/llm       │
│   (Ollama Docker) │
└──────────────────┘
```

### Principes cles

**1. L'agent vit dans l'API, pas dans un process separe**
L'agent est un service dans `apps/api` — pas besoin d'un `apps/agent` separe. Il appelle les autres services directement (pas via HTTP vers lui-meme). Plus simple, plus performant.

**2. Notifications push sans service tiers**
Pas de Firebase, pas d'APNs. On utilise un systeme de **pull-based push** :
- Le scheduler ecrit dans une table `push_queue`
- L'app mobile poll `GET /api/push/pending` toutes les 30s (ou via SSE)
- Quand il y a une notification, l'app mobile l'affiche en notification Android locale
- C'est exactement comme ca que fonctionne deja le SSE pour les rappels dans l'app desktop

**3. L'app mobile est un client leger**
L'app mobile n'a PAS besoin de repliquer toute l'UI desktop. Elle a 3 ecrans :
- **Chat** : parler a l'agent (l'interface principale)
- **Dashboard compact** : brief du jour, streak, taches prio, prochain event
- **Notifications** : historique des push recus

Tout le reste (calendrier, notes, triage, email, analytics) reste sur le desktop.

**4. Acces reseau**
L'API tourne sur ton PC. Le mobile y accede via :
- **WiFi local** : meme reseau → `http://192.168.x.x:47300`
- **Tailscale** (optionnel, gratuit, sans serveur tiers) : acces hors du reseau local
- **WireGuard** (alternative) : VPN maison

---

## Implementation

### Phase 1 — Agent Core (tool-calling dans le chat)

**Objectif :** Le chat existant (desktop + futur mobile) devient intelligent — il comprend tes donnees.

Actuellement le chat LLM est "bete" : il envoie tes messages au LLM sans contexte.
On le transforme en **agent avec tools** : le LLM peut appeler les services internes.

**Approche : Function calling / Tool use**

```typescript
// apps/api/src/application/agent/tool-registry.ts
export interface AgentTool {
  name: string;
  description: string;  // Le LLM lit ca pour decider quand utiliser le tool
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// apps/api/src/application/agent/tools/analytics.tools.ts
export function createAnalyticsTools(analyticsService: AnalyticsService): AgentTool[] {
  return [
    {
      name: "get_productivity_overview",
      description: "Recupere les stats de productivite sur une periode : temps de focus, sessions, triage, wellness, emails, events",
      parameters: {
        from: { type: "string", description: "Date debut YYYY-MM-DD", required: true },
        to: { type: "string", description: "Date fin YYYY-MM-DD", required: true },
      },
      execute: async (params) => {
        return analyticsService.getOverview(new Date(params.from as string), new Date(params.to as string));
      },
    },
    {
      name: "get_streak",
      description: "Recupere le streak de focus (jours consecutifs avec du temps de focus)",
      parameters: {},
      execute: async () => analyticsService.getStreak(),
    },
    // ...
  ];
}
```

**Le flow :**
1. User : "Combien de temps j'ai bosse cette semaine ?"
2. AgentService envoie au LLM avec les tools disponibles (format Ollama/OpenAI function calling)
3. LLM decide d'appeler `get_productivity_overview` avec `from=2026-03-11, to=2026-03-17`
4. AgentService execute l'appel, recupere les donnees
5. AgentService renvoie les donnees au LLM
6. LLM formule une reponse : "Cette semaine tu as 12h30 de focus sur 28 sessions..."

**Fichiers :**

| Action | Fichier |
|--------|---------|
| Creer | `apps/api/src/application/agent/agent.service.ts` — orchestrateur (LLM + tool loop) |
| Creer | `apps/api/src/application/agent/tool-registry.ts` — registre + interface AgentTool |
| Creer | `apps/api/src/application/agent/tools/analytics.tools.ts` |
| Creer | `apps/api/src/application/agent/tools/timer.tools.ts` |
| Creer | `apps/api/src/application/agent/tools/task.tools.ts` |
| Creer | `apps/api/src/application/agent/tools/email.tools.ts` |
| Creer | `apps/api/src/application/agent/tools/calendar.tools.ts` |
| Creer | `apps/api/src/application/agent/tools/brief.tools.ts` |
| Creer | `apps/api/src/application/agent/tools/project.tools.ts` |
| Creer | `apps/api/src/presentation/routes/agent.routes.ts` — POST /api/agent/chat |
| Modifier | `apps/api/src/index.ts` — wiring AgentService |
| Modifier | `apps/desktop/src/ui/components/chat/ChatView.tsx` — utiliser /api/agent/chat |

**Endpoint :**
```
POST /api/agent/chat
Body: { message: string, conversationId?: string }
Response: { response: string, toolCalls?: { tool: string, result: unknown }[] }
```

---

### Phase 2 — Scheduler + Push Queue

**Objectif :** L'agent te contacte de lui-meme quand c'est pertinent.

**DB :**
```sql
CREATE TABLE push_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'brief', 'streak', 'inbox', 'stale-task', 'pr'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,           -- null = non lu
);
```

**Scheduler :**
```typescript
// apps/api/src/application/agent/scheduler.ts
import * as cron from "node-cron";

export class AgentScheduler {
  constructor(
    private agentService: AgentService,
    private pushRepo: PushNotificationRepository,
  ) {}

  start() {
    // Brief du matin (lun-ven 8h)
    cron.schedule("0 8 * * 1-5", () => this.morningBrief());

    // Weekly review (dimanche 19h)
    cron.schedule("0 19 * * 0", () => this.weeklyReview());

    // Streak nudge (lun-ven 17h)
    cron.schedule("0 17 * * 1-5", () => this.streakNudge());

    // Inbox check (toutes les 2h)
    cron.schedule("0 */2 * * *", () => this.inboxAlert());
  }

  private async morningBrief() {
    const brief = await this.agentService.generateBrief();
    await this.pushRepo.create({
      type: "brief",
      title: "Brief du jour",
      body: brief,
    });
  }

  private async streakNudge() {
    const streak = await this.agentService.getStreak();
    const todayStats = await this.agentService.getTodayStats();
    if (streak.currentStreak > 0 && todayStats.totalSeconds === 0) {
      await this.pushRepo.create({
        type: "streak",
        title: "Streak en danger !",
        body: `Ton streak de ${streak.currentStreak} jours va se briser. Lance un pomodoro ?`,
      });
    }
  }
  // ...
}
```

**Routes :**
```
GET  /api/push/pending              → notifications non lues
GET  /api/push                       → toutes (avec pagination)
POST /api/push/:id/read             → marquer comme lu
GET  /api/push/stream               → SSE pour push temps reel
```

**Fichiers :**

| Action | Fichier |
|--------|---------|
| Creer | Migration `push_notifications` table |
| Creer | `apps/api/src/domain/push/push-notification.entity.ts` |
| Creer | `apps/api/src/domain/push/push-notification.repository.ts` |
| Creer | `apps/api/src/infrastructure/repositories/push-notification.repository.impl.ts` |
| Creer | `apps/api/src/application/agent/scheduler.ts` |
| Creer | `apps/api/src/presentation/routes/push.routes.ts` |
| Modifier | `apps/api/src/index.ts` — wiring scheduler + push routes |
| Modifier | `apps/api/src/infrastructure/database/schema.ts` — push table |

---

### Phase 3 — App mobile (Kotlin + Jetpack Compose)

**Objectif :** Interface mobile legere pour le chat agent + notifications.

S'aligne avec les specs mobile existantes (`docs/mobile/`) et la stack deja prevue (Kotlin + Compose + Material 3).

**3 ecrans seulement :**

#### Ecran 1 : Chat Agent (ecran principal)

```
┌─────────────────────────────┐
│  Magick Cookie        [⚙️]  │
├─────────────────────────────┤
│                             │
│  [Agent] Bonjour ! Tu as   │
│  3 taches prio aujourd'hui  │
│  et un streak de 12 jours.  │
│                             │
│         [Toi] Brief         │
│                             │
│  [Agent] ## Hier            │
│  - 3h20 focus, 6 pomodoros  │
│  - Trie 4 taches           │
│  ## Aujourd'hui             │
│  - 2 reunions (14h, 16h30) │
│  - 15 emails non lus       │
│                             │
│     [Toi] Lance un pomo    │
│           sur le projet API │
│                             │
│  [Agent] ✅ Pomodoro        │
│  demarre (25 min) - API    │
│                             │
├─────────────────────────────┤
│  [Message...]        [Envoyer] │
├─────────────────────────────┤
│  💬 Chat   📊 Accueil  🔔 Notifs │
└─────────────────────────────┘
```

- Appelle `POST /api/agent/chat`
- Markdown rendu (gras, listes, titres)
- Boutons rapides en haut : "Brief", "Taches prio", "Streak"

#### Ecran 2 : Dashboard compact

```
┌─────────────────────────────┐
│  Mardi 17 mars 2026         │
├─────────────────────────────┤
│  🔥 Streak : 12 jours       │
│  ⏱️ Focus : 2h15 aujourd'hui │
│  📋 3 taches prioritaires   │
│  📧 15 emails non lus       │
├─────────────────────────────┤
│  Prochain event             │
│  14h00 — Reunion equipe     │
├─────────────────────────────┤
│  Brief du jour              │
│  [Voir le brief complet →]  │
├─────────────────────────────┤
│  💬 Chat   📊 Accueil  🔔 Notifs │
└─────────────────────────────┘
```

- Appelle `/analytics/streak`, `/timer-sessions/stats/today`, `/triage?status=priority`, `/emails/unread-count`, `/events` (today)

#### Ecran 3 : Notifications

```
┌─────────────────────────────┐
│  Notifications               │
├─────────────────────────────┤
│  🔥 Streak en danger !       │
│  17 mars, 17h00              │
│  Ton streak de 12 jours...  │
├─────────────────────────────┤
│  📋 Brief du jour            │
│  17 mars, 08h00              │
│  3h focus hier, 2 reunions..│
├─────────────────────────────┤
│  📧 Inbox deborde            │
│  16 mars, 14h00              │
│  Tu as 23 emails non lus... │
├─────────────────────────────┤
│  💬 Chat   📊 Accueil  🔔 Notifs │
└─────────────────────────────┘
```

- Appelle `GET /api/push/pending`
- Poll en background avec WorkManager (toutes les 15-30 min)
- Affiche une notification Android locale quand il y a du nouveau

**Structure du projet mobile :**

```
apps/mobile/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/magickcookie/
│       │   ├── MainActivity.kt
│       │   ├── data/
│       │   │   ├── api/
│       │   │   │   ├── ApiClient.kt           # Retrofit client
│       │   │   │   ├── AgentApi.kt            # POST /agent/chat
│       │   │   │   ├── AnalyticsApi.kt        # GET /analytics/*
│       │   │   │   └── PushApi.kt             # GET /push/*
│       │   │   └── model/
│       │   │       ├── ChatMessage.kt
│       │   │       ├── StreakData.kt
│       │   │       ├── PushNotification.kt
│       │   │       └── DashboardData.kt
│       │   ├── ui/
│       │   │   ├── theme/
│       │   │   │   └── Theme.kt               # Dark/Light/Cookie (memes couleurs)
│       │   │   ├── chat/
│       │   │   │   └── ChatScreen.kt          # Ecran chat agent
│       │   │   ├── dashboard/
│       │   │   │   └── DashboardScreen.kt     # Ecran accueil compact
│       │   │   ├── notifications/
│       │   │   │   └── NotificationsScreen.kt # Historique notifs
│       │   │   └── settings/
│       │   │       └── SettingsScreen.kt      # Config URL API
│       │   └── worker/
│       │       └── PushPollWorker.kt          # WorkManager background poll
│       └── res/
│           └── ...
├── build.gradle.kts
└── settings.gradle.kts
```

**Dependances :**
- `retrofit2` + `moshi` — appels API
- `androidx.compose.*` — UI
- `androidx.work` — WorkManager pour le polling background
- `androidx.navigation.compose` — navigation 3 tabs
- `io.coil-kt:coil-compose` — images (optionnel)

**Pas de dependances tierces pour les notifications** — on utilise `NotificationManager` d'Android directement, declenche par le `PushPollWorker`.

**Settings :**
- URL de l'API (ex: `http://192.168.1.42:47300`)
- Intervalle de poll des notifications (15/30/60 min)
- Theme (dark/light/cookie)

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
| Creer | `apps/api/src/domain/agent-memory/agent-memory.entity.ts` |
| Creer | `apps/api/src/domain/agent-memory/agent-memory.repository.ts` |
| Creer | `apps/api/src/infrastructure/repositories/agent-memory.repository.impl.ts` |
| Creer | `apps/api/src/application/agent/memory.service.ts` |
| Creer | `apps/api/src/application/agent/context-builder.ts` — construit le prompt enrichi |
| Modifier | `apps/api/src/application/agent/agent.service.ts` — injecter le contexte |

---

## Ordre d'implementation

```
Phase 1 — Agent Core (tool-calling)             ← fondation, enrichit le chat desktop
Phase 2 — Scheduler + Push Queue                ← l'agent devient proactif
Phase 3 — App mobile                            ← acces depuis le telephone
Phase 4 — Memoire contextuelle                  ← personnalisation
```

Les phases 1 et 2 apportent de la valeur sur le desktop immediatement.
La phase 3 (mobile) peut commencer en parallele de la phase 2.

---

## Acces reseau mobile → API

L'API tourne sur ton PC (port 47300). Le mobile doit y acceder.

| Methode | Setup | Hors du reseau local |
|---------|-------|---------------------|
| **WiFi local** | Rien a faire, meme reseau | Non |
| **Tailscale** | Installer Tailscale sur PC + mobile (gratuit, zero config, P2P chiffre) | Oui |
| **WireGuard** | Config VPN maison sur ton routeur ou VPS | Oui |
| **Reverse proxy** | Nginx sur VPS + HTTPS + auth token | Oui |

**Recommandation :** WiFi local pour commencer (zero config), Tailscale si tu veux l'acces hors de chez toi (c'est du P2P chiffre, pas de serveur tiers qui voit tes donnees).

---

## Differences avec OpenClaw

| Aspect | OpenClaw | Magick Cookie Agent |
|--------|----------|---------------------|
| Scope | Acces complet au systeme (fichiers, shell, navigateur) | Donnees de productivite uniquement |
| Securite | Sandbox + permissions granulaires | API REST = safe by design |
| Canaux | 24+ services tiers (WhatsApp, Signal...) | App mobile maison + desktop (zero tiers) |
| Notifications | Via services de messagerie tiers | Push queue locale + notification Android native |
| Multi-user | Multi-tenant, pairing | Single-user |
| Skills | Marketplace communautaire | Tools fixes lies a l'API |
| Complexite | Gateway WebSocket, RPC, device nodes | HTTP client + LLM + poll |
| Modele IA | Claude/GPT/local | LLM local (Ollama) — tout reste chez toi |
| Donnees | Transitent par les services de messagerie | Restent sur ton reseau local |

## Notes

- **LLM : privilegier le tool-calling natif** — Ollama supporte le function calling depuis v0.4+. Sinon, fallback sur du prompt engineering avec format JSON.
- **L'app mobile est un MVP** — 3 ecrans, pas une replique du desktop. Le desktop reste l'interface principale.
- **Pas de Firebase/APNs** — Les notifications sont gerees par polling + WorkManager. C'est un peu moins instantane (15-30s de latence) mais zero dependance Google.
- **Toutes les specs mobile existantes (`docs/mobile/`) restent valides** — Elles decrivent une app mobile complete (calendrier, notes, triage, etc.). Ce plan-ci decrit un **MVP agent-first** qui peut evoluer vers l'app complete.
