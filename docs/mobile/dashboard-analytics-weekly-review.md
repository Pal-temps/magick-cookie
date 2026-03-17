# Dashboard Analytics & Weekly Review — Mobile Spec

## Dashboard Analytics

### Objectif
Widget agrege sur le dashboard affichant les metriques cles de productivite et habitudes sur 7j ou 30j.

### API Endpoint

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` | Vue d'ensemble agregee |

### Reponse

```typescript
interface AnalyticsOverview {
  period: { from: string; to: string };
  focus: {
    totalSeconds: number;
    sessionCount: number;
    completedCount: number;
    dailyStats: { date: string; totalSeconds: number }[];
  };
  triage: {
    byStatus: Record<string, number>;  // { priority: 5, later: 3, archived: 2 }
    totalTriaged: number;
  };
  wellness: {
    waterAvg: number;    // ml moyenne/jour
    fruitAvg: number;    // portions moyenne/jour
    daysTracked: number;
  };
  email: {
    received: number;
    unread: number;
    dailyStats: { date: string; count: number }[];
  };
  events: {
    total: number;
    dailyStats: { date: string; count: number }[];
  };
  dogWalk: {
    totalWalks: number;
    totalSeconds: number;
    dailyStats: { date: string; walkCount: number }[];
  };
}
```

### Affichage mobile

- Selecteur de periode : boutons "7j" / "30j" en haut du widget
- 2 rangees de 3 cards metriques :
  - Focus (duree formatee), Sessions, Evenements
  - Emails, Tries, Balades
- Mini bar chart horizontal pour `focus.dailyStats` (hauteur ~60px)
- Les `dailyStats` de chaque domaine permettent d'afficher des sparklines si souhaite

### Comportement
- Chargement au mount du widget, re-fetch quand la periode change
- Les valeurs numeriques sont formatees : secondes → "Xh Ymin", grands nombres avec separateur

---

## Weekly Review

### Objectif
Bilan hebdomadaire avec comparaison semaine precedente, accessible depuis un bouton "Bilan hebdo" sur le dashboard.

### API Endpoint

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/analytics/weekly-review?week=YYYY-WNN` | Bilan d'une semaine ISO |

### Reponse

```typescript
interface WeeklyReview {
  week: string;                    // "2026-W12"
  current: AnalyticsOverview;      // Semaine demandee
  previous: AnalyticsOverview;     // Semaine precedente
  deltas: {
    focusSeconds: number | null;   // % de variation, null si 0→0
    sessionCount: number | null;
    totalTriaged: number | null;
    emailReceived: number | null;
    eventsTotal: number | null;
    dogWalks: number | null;
  };
}
```

### Logique des deltas
- `null` : les deux semaines sont a 0 (pas de donnees)
- `100` : passage de 0 a N (apparition)
- `-100` : passage de N a 0 (disparition)
- `0` : meme valeur
- Autre : `round(((current - previous) / previous) * 100)`

### Affichage mobile

- Navigation semaine : boutons `<` / `>` + label "2026-W12" au centre
- 3 cards resume en haut : Focus total, Sessions, Emails recus (valeurs de `current`)
- Section "Evolution vs semaine precedente" :
  - Liste verticale avec pour chaque metrique : label + badge colore
  - Vert + fleche ↑ si delta > 0
  - Rouge + fleche ↓ si delta < 0
  - Gris "=" si delta == 0
  - Masque si delta == null
- Section "Bien-etre" : 3 cards (Eau moy/j, Fruits moy/j, Jours suivis)

### Comportement
- Au mount : charge la semaine courante (calcul ISO week cote client)
- Navigation : recalcule le string "YYYY-WNN" et re-fetch
- Le format ISO week suit la norme : semaine 1 contient le 4 janvier
