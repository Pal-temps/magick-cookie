# Spec Mobile — Connecteur ClickUp

## Endpoints API

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/connectors/clickup/sync` | Declenche une synchronisation complete ClickUp → do-it-now |
| GET | `/api/connectors/clickup/tasks` | Liste les taches sans date (unscheduled) |

## Comportement de la sync

1. L'API recupere toutes les taches de tous les workspaces ClickUp
2. Taches **avec due_date** → crees/mises a jour comme events dans un calendrier dedie "ClickUp" (couleur `#7B68EE`)
3. Taches **sans due_date** → stockees dans une table separee `clickup_unscheduled_tasks`
4. Les events sont lies a ClickUp via le champ `clickup_task_id` (unique) pour eviter les doublons
5. Les taches unscheduled qui n'existent plus dans ClickUp sont supprimees

## Reponse sync

```json
{
  "data": {
    "eventsCreated": 5,
    "eventsUpdated": 2,
    "unscheduledCount": 8
  }
}
```

## Modele UnscheduledTask

```typescript
interface UnscheduledTask {
  id: string;
  clickupTaskId: string;
  name: string;
  description: string | null;
  status: string;
  url: string;
  listName: string;
  priority: string | null;  // "urgent" | "high" | "normal" | "low" | null
  assignees: string[];
  createdAt: string;
  updatedAt: string;
}
```

## Mapping ClickUp → Event

| ClickUp | Event |
|---------|-------|
| name | title |
| start_date (ou due_date - 1h) | startAt |
| due_date | endAt |
| url | location |
| `[status] listName\nurl\ndescription` | description |

## Particularites UX mobile

### Sync
- Bouton "Sync ClickUp" dans les parametres ou en haut de l'ecran
- Sync automatique au lancement de l'app
- Indicateur de chargement pendant la sync (spinner / progress)
- Toast de confirmation : "5 events crees, 2 mis a jour"

### Taches sans date
- Section dedicee dans un onglet ou un drawer
- Chaque tache affiche : nom, status, liste, priorite (pastille coloree)
- Tap sur une tache → ouvre l'URL ClickUp dans le navigateur
- Possibilite de glisser-deposer une tache sur le calendrier pour lui assigner une date (future feature)

### Indicateurs de priorite
- Urgent : rouge `#d63031`
- High : orange `#fdcb6e`
- Normal : bleu `#0984e3`
- Low : gris `#8888a8`

### Events ClickUp dans le calendrier
- Affiches avec la couleur du calendrier ClickUp (`#7B68EE`)
- Badge ou icone ClickUp pour les distinguer des events manuels
- Tap sur un event ClickUp → detail avec lien "Ouvrir dans ClickUp"
