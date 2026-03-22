# Analytics & Weekly Review

> Statut : **Done** — Dashboard widgets, charts, streaks, patterns, weekly review avec deltas.

Metriques visuelles sur la productivite et les habitudes. Graphiques avec tendances, comparaisons, contribution graph.

## Architecture

```
api/src/
├── application/analytics/
│   └── analytics.service.ts          # Agregate queries, getWeeklyReview()
├── presentation/routes/
│   └── analytics.routes.ts

desktop/src/
├── application/stores/analyticsStore.ts
└── ui/components/dashboard/
    ├── AnalyticsWidget.tsx            # Widget agrege
    ├── StatsView.tsx                  # Vue detaillee
    ├── DailyStats.tsx                 # Stats du jour
    ├── StreakWidget.tsx               # Contribution graph 30j
    ├── WeeklyReview.tsx              # Bilan hebdomadaire
    └── PatternsView.tsx              # Distribution horaire/jour
```

## API

```
GET /api/analytics/focus?from=&to=          # Stats timer
GET /api/analytics/triage?from=&to=         # Stats triage
GET /api/analytics/wellness?from=&to=       # Stats wellness
GET /api/analytics/overview?from=&to=       # Tout agrege
GET /api/analytics/streak                   # Streak + last30Days
GET /api/analytics/weekly-review?week=2026-W12  # Bilan hebdo
```

## Metriques

| Categorie | Metrique | Visualisation |
|-----------|----------|---------------|
| Focus | Temps focus par jour/semaine | Bar chart empile (work/break) |
| Focus | Pomodoros completes vs abandonnes | Ratio |
| Focus | Streak jours consecutifs | Compteur + flamme |
| Triage | Taches triees par statut | Donut (priority/later/archived) |
| Triage | Taches triees par jour | Line chart tendance |
| Wellness | Progression par type | Progress bars + historique |
| Email | Recus / traites par jour | Bar chart stacked |
| Dog Walk | Duree moyenne / semaine | Bar chart |

## Fonctionnalites

### Dashboard widgets configurables
- Widgets reordonnables par drag & drop
- Visibilite configurable par l'utilisateur
- Persistance en localStorage
- Periode selectionnable : 7j / 30j / 90j

### Streak tracker
- Contribution graph style GitHub (30 derniers jours)
- Couleur = intensite du focus
- Seuil configurable (defaut: 1 session/jour)
- `currentStreak` + `longestStreak`

### Patterns de productivite
- Distribution horaire (a quelle heure tu travailles le plus)
- Distribution par jour de la semaine
- Tendances sur la periode

### Weekly Review
- Resume par section : focus, triage, wellness, emails, calendrier
- Indicateurs ↑↓ par rapport a la semaine precedente (pctDelta)
- Resume narratif via LLM (optionnel)
- Accessible depuis le dashboard ou notification push dimanche 19h
