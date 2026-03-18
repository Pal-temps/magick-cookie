# Roadmap — Prochaines features

## Vue d'ensemble

| # | Feature | Priorite | Complexite | Statut |
|---|---------|----------|------------|--------|
| 1 | Dashboard Analytics | Haute | Moyenne | ✅ Done (overview, streak, widgets, AnalyticsWidget, StatsView) |
| 2 | Weekly Review | Haute | Moyenne | ✅ Done (API weekly-review + WeeklyReview UI + deltas) |
| 3 | Raccourcis clavier Email | Moyenne | Faible | ✅ Done (j/k/Enter/Escape/e/s/r/Delete + g+i/g+s chords) |
| 4 | Integration LLM local | Haute | Haute | ✅ Done (Ollama/LM Studio/OpenAI adapters, LlmSettings UI) |
| 5 | Resume email par IA | Moyenne | Faible | ✅ Done (summarize dans EmailDetail + EmailDigest hebdo) |
| 6 | Flux RSS | Moyenne | Moyenne | ✅ Done (rss-parser, sync 15min, RssView two-column, dedup guid) |

---

## 1. Dashboard Analytics

### Objectif
Remplacer/enrichir le dashboard actuel avec des metriques visuelles sur la productivite et les habitudes. Graphiques avec tendances, pas juste des compteurs.

### Metriques a afficher

| Categorie | Metrique | Source | Visualisation |
|-----------|----------|--------|---------------|
| Focus | Temps focus par jour/semaine | `timer_sessions` | Bar chart empile (work/break) |
| Focus | Pomodoros completes vs abandonnes | `timer_sessions.completed` | Ratio / pie chart |
| Focus | Streak de jours avec >= 1 pomodoro | `timer_sessions` | Compteur + flamme |
| Triage | Taches triees par statut | `task_triage` | Donut (priority/later/archived) |
| Triage | Taches triees par jour | `task_triage.triaged_at` | Line chart tendance |
| Wellness | Progression quotidienne par type | `wellness_logs` | Progress bars + historique |
| Wellness | Streak par habitude | `wellness_logs` | Compteur + calendar heatmap |
| Dog Walk | Duree moyenne / semaine | `dog_walks` | Bar chart |
| Dog Walk | Nombre de balades / jour | `dog_walks` | Mini calendar dots |
| Email | Emails recus / traites par jour | `emails` | Bar chart stacked (lu/non lu) |
| Email | Inbox zero streak | `emails.is_read` | Compteur |

### Architecture

**Backend** :
- `GET /api/analytics/focus?from=&to=` — stats timer
- `GET /api/analytics/triage?from=&to=` — stats triage
- `GET /api/analytics/wellness?from=&to=` — stats wellness
- `GET /api/analytics/overview?from=&to=` — tout agrege
- Nouveau service `AnalyticsService` qui query les repos existants (pas de nouvelles tables)

**Frontend** :
- Nouveau widget `AnalyticsWidget` dans le dashboard
- Lib de charts : `chart.js` + `solid-chartjs` ou `uPlot` (leger)
- Periode selectionnable : 7j / 30j / 90j
- Vue detaillee accessible en cliquant sur un widget

### Phases

- [x] Phase 1 : Routes API analytics (agregate queries SQL)
- [x] Phase 2 : Widgets focus + wellness (AnalyticsWidget, StatsView, DailyStats)
- [x] Phase 3 : Charts triage, email, dog walk (dans AnalyticsWidget overview)
- [x] Phase 4 : Calendar heatmap + streaks (StreakWidget avec contribution graph)

---

## 2. Weekly Review

### Objectif
Chaque dimanche (ou a la demande), generer un resume de la semaine : ce qui a ete fait, ce qui reste, les tendances.

### Contenu de la review

| Section | Donnees |
|---------|---------|
| Resume focus | Total heures focus, nb pomodoros, comparaison semaine precedente (+/-%) |
| Triage | Nb taches triees, repartition statuts, taches encore non triees |
| Wellness | Goals atteints/manques par type, streaks en cours |
| Emails | Recus, lus, archives, inbox actuel |
| Calendrier | Nb evenements, prochains evenements importants |
| Dog walks | Nb balades, duree totale, comparaison |

### Architecture

**Backend** :
- `GET /api/analytics/weekly-review?week=2026-W12` (ou `?from=&to=`)
- Reutilise `AnalyticsService` — une methode `getWeeklyReview(from, to)`
- Retourne un objet structure avec toutes les sections

**Frontend** :
- Vue dediee ou modal accessible depuis le dashboard
- Affichage card par section avec indicateurs ↑↓ par rapport a la semaine precedente
- Bouton "Generer le resume IA" (quand feature #4 est prete) pour un texte narratif

### Phases

- [x] Phase 1 : Endpoint API weekly review (reutilise analytics)
- [x] Phase 2 : UI cards de review dans le dashboard (WeeklyReview.tsx)
- [x] Phase 3 : Comparaison semaine precedente (deltas avec pctDelta)
- [x] Phase 4 : Resume narratif via LLM local (#4)

---

## 3. Raccourcis clavier Email

### Objectif
Navigation et actions rapides dans la vue email, style Gmail.

### Raccourcis prevus

| Touche | Action | Contexte |
|--------|--------|----------|
| `j` / `k` | Email suivant / precedent | Liste emails |
| `Enter` | Ouvrir l'email selectionne | Liste emails |
| `Escape` | Retour a la liste | Detail email |
| `e` | Archiver | Email selectionne |
| `s` | Star / unstar | Email selectionne |
| `r` | Marquer lu / non lu | Email selectionne |
| `#` ou `Delete` | Supprimer | Email selectionne |
| `g` then `i` | Aller a Inbox | Global email |
| `g` then `s` | Aller a Sent | Global email |
| `/` | Focus barre de recherche | Global email (future) |
| `Ctrl+6` | Ouvrir vue email | Global app (deja fait) |

### Implementation
- `onKeyDown` handler dans `EmailView.tsx`
- Etat `focusedIndex` pour naviguer dans la liste sans clic
- Highlight visuel de l'email "focused" distinct du "selected"

### Phases

- [x] Phase 1 : j/k navigation + Enter/Escape
- [x] Phase 2 : Actions e/s/r/Delete sur email selectionne
- [x] Phase 3 : Sequences g+i, g+s (chord avec timeout 500ms)

---

## 4. Integration LLM local

### Objectif
Connecter un LLM local (Ollama, LM Studio, llama.cpp) a l'app pour des features IA sans dependance cloud. Architecture generique pour permettre plusieurs usages.

### Architecture

```
api/src/
├── domain/llm/
│   ├── llm.entity.ts            # LlmConfig, LlmProvider, ChatMessage, ChatResponse
│   └── llm.port.ts              # interface LlmPort { chat(), summarize(), classify() }
├── application/llm/
│   └── llm.service.ts           # Orchestration, retry, fallback
├── infrastructure/
│   ├── adapters/
│   │   ├── ollama.adapter.ts    # Ollama REST API adapter
│   │   ├── lmstudio.adapter.ts  # LM Studio (compatible OpenAI API)
│   │   ├── openai.adapter.ts    # OpenAI-compatible (fallback cloud)
│   │   └── anthropic.adapter.ts # Anthropic Messages API (system as top-level param)
│   └── repositories/
│       └── llm-config.repository.impl.ts
├── presentation/
│   ├── routes/llm.routes.ts
│   └── validators/llm.validator.ts

desktop/src/
├── ui/components/llm/
│   └── LlmSettings.tsx          # Config UI : provider, URL, modele, test
```

### Adapter Anthropic

L'adapter Anthropic (`anthropic.adapter.ts`) implemente `LlmPort` en utilisant l'API Messages d'Anthropic.
Particularite : le parametre `system` est envoye en top-level (pas dans le tableau `messages`), conformement a l'API Anthropic.

- Provider : `"anthropic"`
- URL par defaut : `https://api.anthropic.com`
- Necessite une API key (`apiKey` dans `LlmConfig`)
- Modeles supportes : Claude Sonnet, Opus, Haiku, etc.

### Configuration (stockee en DB)

```typescript
interface LlmConfig {
  id: string;
  provider: "ollama" | "lmstudio" | "openai-compatible" | "anthropic";
  baseUrl: string;           // ex: http://localhost:11434
  model: string;             // ex: llama3.2, mistral, phi-3
  apiKey: string | null;     // null pour Ollama local
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}
```

### API

```
GET    /api/llm/config           # Config actuelle
PUT    /api/llm/config           # Modifier la config
POST   /api/llm/test             # Tester la connexion au LLM
POST   /api/llm/chat             # Envoyer un prompt (usage generique)
POST   /api/llm/summarize        # Resumer un texte (raccourci)
```

### Adapters

Tous implementent la meme interface `LlmPort` :

| Provider | API | URL par defaut |
|----------|-----|----------------|
| Ollama | `POST /api/generate` ou `/api/chat` | `http://localhost:11434` |
| LM Studio | OpenAI-compatible `POST /v1/chat/completions` | `http://localhost:1234` |
| OpenAI-compatible | Idem LM Studio | Configurable |
| Anthropic | `POST /v1/messages` | `https://api.anthropic.com` |

### Phases

- [x] Phase 1 : Entites, port, adapter Ollama, route `/llm/chat` + `/llm/test`
- [x] Phase 2 : UI settings (LlmSettings.tsx — provider, URL, modele, test)
- [x] Phase 3 : Adapter OpenAI-compatible (couvre LM Studio aussi)
- [x] Phase 4 : Methodes specialisees (`classify`, `generateNarrative`) + adapter Anthropic

---

## 5. Resume email par IA

### Objectif
Bouton "Resumer" dans `EmailDetail` qui envoie le contenu de l'email au LLM local et affiche un resume concis.

### UX

1. Bouton "Resumer" dans la toolbar de `EmailDetail`
2. Clic → spinner → affiche le resume au-dessus du body
3. Le resume est cache/ephemere (pas stocke en DB pour l'instant)
4. Option future : stocker le resume en DB pour ne pas re-generer

### Implementation

**Backend** :
- `POST /api/emails/:id/summarize` → recupere l'email, envoie `bodyText` au LLM via `LlmService.summarize()`
- Prompt systeme : "Resume cet email en 2-3 phrases en francais. Extrais les actions requises si il y en a."

**Frontend** :
- Signal `summary` dans le composant
- Bouton conditionnel (affiche seulement si LLM configure + email a du contenu)
- Affichage dans un bandeau colore au-dessus du body

### Phases

- [x] Phase 1 : Route API + integration LlmService (summarizeEmail dans emailStore)
- [x] Phase 2 : UI bouton + affichage resume (EmailDetail + EmailDigest)
- [x] Phase 3 : Cache du resume en DB (colonne `summary` + `classification` dans `emails`)
- [x] Phase 4 : Classification auto (newsletter, facture, action_requise, personnel, notification, autre)

---

## 6. Flux RSS

### Objectif
Lecteur RSS integre pour suivre des blogs, actus tech, changelogs — sans quitter l'app.

### Architecture

```
api/src/
├── domain/rss/
│   ├── rss-feed.entity.ts          # RssFeed { id, url, title, siteUrl, lastFetchedAt }
│   ├── rss-article.entity.ts       # RssArticle { id, feedId, guid, title, link, content, pubDate, isRead }
│   ├── rss-feed.repository.ts      # Interface repository feeds
│   └── rss-article.repository.ts   # Interface repository articles
├── application/rss/
│   └── rss.service.ts              # CRUD + sync + deduplication par guid
├── infrastructure/
│   ├── adapters/
│   │   └── rss-parser.adapter.ts   # Connecteur rss-parser (npm)
│   └── repositories/
│       ├── rss-feed.repository.impl.ts
│       └── rss-article.repository.impl.ts
├── presentation/
│   └── routes/rss.routes.ts

desktop/src/
├── application/stores/rssStore.ts  # Feeds, articles, compteurs non lus
├── ui/components/rss/
│   └── RssView.tsx                 # Two-column: feed sidebar + article list
```

### API

```
GET    /api/rss/feeds                # Liste des feeds
POST   /api/rss/feeds                # Ajouter un feed
PUT    /api/rss/feeds/:id            # Modifier un feed
DELETE /api/rss/feeds/:id            # Supprimer un feed
GET    /api/rss/feeds/:id/articles   # Articles d'un feed
GET    /api/rss/articles             # Tous les articles (filtres)
PUT    /api/rss/articles/:id         # Marquer lu/non lu
POST   /api/rss/feeds/sync           # Forcer un sync manuel
```

### Sync job
- Background job toutes les 15 minutes
- Parse chaque feed via `rss-parser`
- Deduplication par `guid` (fallback `link`) pour eviter les doublons
- Met a jour `lastFetchedAt` sur le feed

### Frontend
- `RssView.tsx` : layout deux colonnes (sidebar feeds a gauche, liste articles a droite)
- `rssStore.ts` : gestion CRUD feeds/articles, compteurs non lus, sync manuel

### Phases

- [x] Phase 1 : Tables DB (rss_feeds, rss_articles) + migration
- [x] Phase 2 : Domain entities + repositories + service CRUD
- [x] Phase 3 : rss-parser adapter + sync job 15min + deduplication guid
- [x] Phase 4 : RssView (two-column) + rssStore + integration sidebar

---

## Ordre d'implementation suggere

```
1. ✅ Dashboard Analytics (Phase 1-4) — DONE
2. ✅ Weekly Review (Phase 1-4)       — DONE (resume narratif LLM inclus)
3. ✅ Integration LLM local (Phase 1-4) — DONE (adapter Anthropic inclus)
4. ✅ Raccourcis clavier Email (Phase 1-3) — DONE
5. ✅ Resume email par IA (Phase 1-4) — DONE (cache + classification auto)
6. ✅ Flux RSS (Phase 1-4)            — DONE (rss-parser + sync 15min + RssView)

Toutes les phases sont completees ✅
```

---

## Notes

- **Charts** : privilegier `uPlot` (7kb) plutot que `chart.js` (200kb) si possible, sinon `chart.js` avec tree-shaking
- **LLM** : Ollama est le plus simple a setup, recommander en premier. LM Studio en alternative GUI-friendly. Anthropic disponible pour les modeles Claude via API key
- **Performance** : les queries analytics doivent etre rapides — prevoir des index si necessaire, possibilite de materialiser des vues
- **Mobile** : toutes ces features sont conçues pour fonctionner aussi en mobile plus tard (voir `docs/mobile/`)
- **Bookmark tags** : les tags de bookmarks sont dynamiques, stockes en DB (table `bookmark_tags` avec `value`, `label`, `sortOrder`), gerees via un CRUD dans les settings — pas de tags hardcodes
- **Email classification** : les categories (`newsletter`, `facture`, `action_requise`, `personnel`, `notification`, `autre`) sont classifiees automatiquement par le LLM et cachees en DB (`summary` + `classification` dans la table `emails`)
