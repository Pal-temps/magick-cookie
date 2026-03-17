# Plan d'implementation — Brief quotidien

## Objectif
Bouton "Brief" sur le dashboard qui genere un resume quotidien en 3 sections (hier, aujourd'hui, blocages) via le LLM configure, a partir des donnees deja presentes dans l'app.

---

## API

### `GET /api/brief/generate?date=2026-03-17`

Le parametre `date` est optionnel (defaut : aujourd'hui).

**Reponse :**

```typescript
interface BriefResponse {
  date: string;
  rawData: BriefRawData;   // les donnees brutes collectees
  brief: string;            // le texte genere par le LLM
}

interface BriefRawData {
  yesterday: {
    timerSessions: { label: string | null; actualSeconds: number; completed: boolean }[];
    totalFocusSeconds: number;
    events: { title: string; startAt: string }[];
    triagedTasks: { title: string; status: string }[];
  };
  today: {
    events: { title: string; startAt: string }[];
    priorityTasks: { title: string; status: string; source: string }[];
    unreadEmails: number;
  };
  blockers: {
    staleTasks: { title: string; daysSinceTriaged: number }[];
    overdueEvents: { title: string; endAt: string }[];
  };
}
```

**Comportement :**
1. Si pas de LLM configure → retourne `rawData` + `brief: ""` (le frontend affiche un fallback formate)
2. Si LLM configure → collecte les donnees, envoie au LLM, retourne tout

---

## Backend

### Nouveau service : `apps/api/src/application/brief/brief.service.ts`

```typescript
class BriefService {
  constructor(
    private timerRepo: TimerSessionRepository,
    private eventRepo: EventRepository,
    private taskRepo: TaskRepository,
    private triageRepo: TriageRepository,
    private emailRepo: EmailRepository,
    private llmService: LlmService,
  ) {}

  async generate(date: Date): Promise<BriefResponse> {
    const rawData = await this.collectData(date);
    const brief = await this.generateBrief(rawData);
    return { date: formatDate(date), rawData, brief };
  }

  private async collectData(date: Date): Promise<BriefRawData> { ... }
  private async generateBrief(data: BriefRawData): Promise<string> { ... }
}
```

**collectData(date) :**
- `yesterday` : date - 1 jour
  - `timerRepo.findAll(yesterdayStart, yesterdayEnd)` → sessions avec labels et durees (interface `TimerSessionRepository.findAll(from?, to?)`)
  - `eventRepo.findAll({ from: yesterdayStart, to: yesterdayEnd })` → reunions d'hier (interface `EventRepository.findAll(filters)`)
  - `triageRepo.findAll()` + filtrer `triagedAt` dans la plage hier → taches triees hier (interface `TriageRepository.findAll()`)
- `today` : date du jour
  - `eventRepo.findAll({ from: todayStart, to: todayEnd })` → reunions du jour
  - `taskRepo.findAll()` + croiser avec `triageRepo` pour filtrer les "priority" → taches prioritaires (interfaces `TaskRepository.findAll()` + `TriageRepository`)
  - `emailRepo.countUnread()` → nombre d'emails non lus (interface `EmailRepository.countUnread()`)
- `blockers` :
  - Taches en "priority" depuis plus de 3 jours : croiser `triageRepo.findByStatus("priority")` avec `triagedAt` ancien, puis `taskRepo.findById()` pour les titres
  - Events passes non encore faits (endAt < now, meme jour)

**Note** : Les taches sont maintenant dans la table generique `tasks` (pas `clickup_unscheduled_tasks`). Le `taskId` dans `task_triage` reference `tasks.id`. Voir `domain/task/task.entity.ts` et `domain/triage/triage.entity.ts`.

**generateBrief(data) :**
- Construit le prompt avec les donnees en JSON
- Appelle `llmService.chat(messages)` si LLM configure
- Retourne `""` sinon

### Prompt systeme

```
Tu es un assistant qui genere des briefs quotidiens pour un developpeur.

Regles :
- Ecris en francais
- 3 sections : "Hier", "Aujourd'hui", "Blocages"
- 2-4 bullet points par section, pas plus
- Utilise des verbes d'action au passe compose (hier) et futur/infinitif (aujourd'hui)
- Si une section est vide, ecris "RAS"
- Mentionne les durees de focus si significatives (> 30min)
- Sois concis et actionnable, pas de blabla

Format markdown avec ## pour les titres de section.
```

### Nouvelle route : `apps/api/src/presentation/routes/brief.routes.ts`

```typescript
export function createBriefRoutes(briefService: BriefService) {
  const app = new Hono();

  app.get("/generate", async (c) => {
    const dateStr = c.req.query("date");
    const date = dateStr ? new Date(dateStr) : new Date();
    const data = await briefService.generate(date);
    return c.json({ data });
  });

  return app;
}
```

### Wiring dans `index.ts`

```typescript
import { BriefService } from "./application/brief/brief.service";
import { createBriefRoutes } from "./presentation/routes/brief.routes";

const briefService = new BriefService(
  timerSessionRepo, eventRepo, taskRepo, triageRepo, emailRepo, llmService,
);

app.route("/api/brief", createBriefRoutes(briefService));
```

---

## Frontend

### Nouveau composant : `apps/desktop/src/ui/components/dashboard/BriefView.tsx`

Vue affichee en overlay sur le dashboard (meme pattern que StatsView / WeeklyReview).

**Layout :**
```
┌─────────────────────────────────────┐
│ Brief quotidien        [date] Retour│
├─────────────────────────────────────┤
│                                     │
│  ## Hier                            │
│  - Travaille 2h30 sur le fix auth   │
│  - Reunion sprint planning (1h)     │
│  - Trie 5 nouvelles taches          │
│                                     │
│  ## Aujourd'hui                     │
│  - 3 reunions prevues               │
│  - Tache prioritaire: fix login bug │
│  - 12 emails non lus               │
│                                     │
│  ## Blocages                        │
│  - "Refacto DB" en priority depuis  │
│    5 jours sans avancement          │
│                                     │
├─────────────────────────────────────┤
│  [Regenerer]  [Copier]  [Editer]    │
└─────────────────────────────────────┘
```

**Composants :**
- Zone de texte du brief (rendu markdown simple ou pre-formate)
- Bouton "Copier" → `navigator.clipboard.writeText(brief)`
- Bouton "Regenerer" → re-appelle l'API
- Bouton "Editer" → bascule en textarea editable
- Si pas de LLM → affiche un fallback formate a partir de `rawData` (listes a puces simples)

### Store : signal dans `analyticsStore.ts`

Pas besoin d'un store dedie — ajouter dans analyticsStore :

```typescript
const [brief, setBrief] = createSignal<{ brief: string; rawData: BriefRawData } | null>(null);
const [briefLoading, setBriefLoading] = createSignal(false);

async function fetchBrief(date?: string) {
  setBriefLoading(true);
  try {
    const qs = date ? `?date=${date}` : "";
    const data = await api.get<BriefResponse>(`/brief/generate${qs}`);
    setBrief(data);
  } finally {
    setBriefLoading(false);
  }
}
```

### Modifications DashboardView.tsx

Ajouter un 3eme bouton dans le header a cote de "Bilan hebdo" et "Statistiques" :

```tsx
<Button variant="secondary" size="sm" onClick={() => setShowBrief(true)}>
  Brief
</Button>
```

Et le `<Show>` correspondant :

```tsx
<Show when={showBrief()}>
  <BriefView onClose={() => setShowBrief(false)} />
</Show>
```

---

## Tests

### `apps/api/src/__tests__/brief.service.test.ts`

Tests avec mocks des repos :

| Test | Description |
|------|-------------|
| Collecte des donnees hier | Verifie que les bons ranges de dates sont passes aux repos |
| Collecte des donnees aujourd'hui | Verifie events du jour + taches prioritaires |
| Detection des blocages | Tache en priority depuis > 3 jours detectee |
| Brief sans LLM | Retourne brief vide + rawData complete |
| Brief avec LLM | Verifie que le prompt contient les donnees et le LLM est appele |
| Date custom | Passer `date=2026-03-15` utilise les bons ranges |

---

## Fichiers a creer/modifier

| Action | Fichier | Description |
|--------|---------|-------------|
| **Creer** | `apps/api/src/application/brief/brief.service.ts` | Service de collecte + generation |
| **Creer** | `apps/api/src/presentation/routes/brief.routes.ts` | Route GET /api/brief/generate |
| **Creer** | `apps/api/src/__tests__/brief.service.test.ts` | Tests unitaires |
| **Creer** | `apps/desktop/src/ui/components/dashboard/BriefView.tsx` | Vue du brief |
| **Modifier** | `apps/api/src/index.ts` | Wire BriefService + route |
| **Modifier** | `apps/desktop/src/application/stores/analyticsStore.ts` | Ajouter fetchBrief + signals |
| **Modifier** | `apps/desktop/src/ui/components/dashboard/DashboardView.tsx` | Bouton Brief + Show |

**Total : 4 fichiers a creer, 3 a modifier**

---

## Etat du codebase (pour reprendre)

Les dependances de cette feature sont deja implementees :
- **LlmService** : `apps/api/src/application/llm/llm.service.ts` — methode `chat(messages)` et `summarize(text, prompt)`
- **TaskRepository** : `apps/api/src/domain/task/task.repository.ts` — `findAll()`, `findById()`
- **TriageRepository** : `apps/api/src/domain/triage/triage.repository.ts` — `findAll()`, `findByStatus()`, `findByTaskId()`
- **TimerSessionRepository** : `apps/api/src/domain/timer-session/timer-session.repository.ts` — `findAll(from?, to?)`
- **EventRepository** : `apps/api/src/domain/event/event.repository.ts` — `findAll(filters)`
- **EmailRepository** : `apps/api/src/domain/email/email.repository.ts` — `countUnread()`
- **analyticsStore (frontend)** : `apps/desktop/src/application/stores/analyticsStore.ts` — ajouter les signaux brief ici
- **DashboardView** : `apps/desktop/src/ui/components/dashboard/DashboardView.tsx` — a les boutons "Bilan hebdo" et "Statistiques", ajouter "Brief" a cote

Le wiring DI est dans `apps/api/src/index.ts`. Tous les repos et services sont instancies la.

## Ordre d'implementation

```
1. ✅ BriefService backend (collectData + generateBrief + route)
2. ✅ Tests unitaires brief.service.test.ts
3. ✅ Wiring index.ts
4. ✅ Frontend BriefView + integration DashboardView (bouton Brief dans header)
5. ✅ Templates customisables (BriefSettings + presets)
6. ✅ Phase 3 : Git activity scan (GitScanService + env GIT_SCAN_REPOS)
```
