# Roadmap — Prochaines features

## Vue d'ensemble

| # | Feature | Priorite | Complexite | Dependances |
|---|---------|----------|------------|-------------|
| 1 | Dashboard Analytics | Haute | Moyenne | Donnees existantes (timer, wellness, triage, dog-walk) |
| 2 | Weekly Review | Haute | Moyenne | Dashboard Analytics (reutilise les queries) |
| 3 | Raccourcis clavier Email | Moyenne | Faible | Feature email (Phase 1 done) |
| 4 | Integration LLM local | Haute | Haute | Aucune — socle generique a poser |
| 5 | Resume email par IA | Moyenne | Faible | #4 (LLM local) + feature email |

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

- [ ] Phase 1 : Routes API analytics (agregate queries SQL)
- [ ] Phase 2 : Widgets focus + wellness (les plus utiles au quotidien)
- [ ] Phase 3 : Charts triage, email, dog walk
- [ ] Phase 4 : Calendar heatmap + streaks

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

- [ ] Phase 1 : Endpoint API weekly review (reutilise analytics)
- [ ] Phase 2 : UI cards de review dans le dashboard
- [ ] Phase 3 : Comparaison semaine precedente (deltas)
- [ ] Phase 4 : Resume narratif via LLM local (#4)

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

- [ ] Phase 1 : j/k navigation + Enter/Escape
- [ ] Phase 2 : Actions e/s/r/# sur email focused
- [ ] Phase 3 : Sequences g+i, g+s

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
│   ├── llm/
│   │   ├── ollama.adapter.ts    # Ollama REST API adapter
│   │   ├── lmstudio.adapter.ts  # LM Studio (compatible OpenAI API)
│   │   └── openai.adapter.ts    # OpenAI-compatible (fallback cloud)
│   └── repositories/
│       └── llm-config.repository.impl.ts
├── presentation/
│   ├── routes/llm.routes.ts
│   └── validators/llm.validator.ts

desktop/src/
├── ui/components/llm/
│   └── LlmSettings.tsx          # Config UI : provider, URL, modele, test
```

### Configuration (stockee en DB)

```typescript
interface LlmConfig {
  id: string;
  provider: "ollama" | "lmstudio" | "openai-compatible";
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

### Phases

- [ ] Phase 1 : Entites, port, adapter Ollama, route `/llm/chat` + `/llm/test`
- [ ] Phase 2 : UI settings (choisir provider, URL, modele, tester)
- [ ] Phase 3 : Adapter LM Studio / OpenAI-compatible
- [ ] Phase 4 : Methodes specialisees (`summarize`, `classify`) avec prompts optimises

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

- [ ] Phase 1 : Route API + integration LlmService
- [ ] Phase 2 : UI bouton + affichage resume
- [ ] Phase 3 : Cache du resume en DB (colonne `summary` dans `emails`)
- [ ] Phase 4 : Classification auto (newsletter, facture, action requise)

---

## Ordre d'implementation suggere

```
1. Dashboard Analytics (Phase 1-2)    ← donnees deja la, impact quotidien
2. Raccourcis clavier Email           ← rapide a faire, QoL
3. Dashboard Analytics (Phase 3-4)    ← completer les charts
4. Weekly Review                      ← reutilise analytics
5. Integration LLM local (Phase 1-2) ← socle IA
6. Resume email par IA               ← premiere utilisation du LLM
7. Integration LLM local (Phase 3-4) ← polish
```

---

## Notes

- **Charts** : privilegier `uPlot` (7kb) plutot que `chart.js` (200kb) si possible, sinon `chart.js` avec tree-shaking
- **LLM** : Ollama est le plus simple a setup, recommander en premier. LM Studio en alternative GUI-friendly
- **Performance** : les queries analytics doivent etre rapides — prevoir des index si necessaire, possibilite de materialiser des vues
- **Mobile** : toutes ces features sont conçues pour fonctionner aussi en mobile plus tard (voir `docs/mobile/`)
