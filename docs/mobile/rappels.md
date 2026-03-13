# Spec Mobile — Rappels

## Endpoints API

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/events/:eventId/reminders` | Lister les rappels d'un evenement |
| POST | `/api/events/:eventId/reminders` | Ajouter un rappel |
| DELETE | `/api/reminders/:id` | Supprimer un rappel |
| GET | `/api/reminders/pending` | Rappels en attente (fallback si SSE indisponible) |
| POST | `/api/reminders/:id/ack` | Confirmer la reception d'un rappel (le marque comme sent) |
| GET | `/api/sse` | **Stream SSE** — connexion persistante, recoit les reminders en temps reel |

## Modele de donnees

```typescript
type ReminderType = "push";

interface Reminder {
  id: string;
  eventId: string;
  type: ReminderType;       // MVP: uniquement "push"
  minutesBefore: number;    // default 15
  scheduledAt: string;      // ISO 8601, = event.startAt - minutesBefore
  sentAt: string | null;    // null = pas encore envoye
  createdAt: string;
}
```

## Architecture notifications (SSE)

L'API utilise Server-Sent Events (SSE) au lieu du polling :

1. Le client ouvre une connexion SSE sur `GET /api/sse`
2. La connexion reste ouverte — le serveur envoie des events quand un reminder est pending
3. Le client recoit l'event, affiche la notification, puis envoie `POST /api/reminders/:id/ack`
4. L'API marque le reminder comme `sent` uniquement apres l'ack du client
5. Heartbeat toutes les 15s pour maintenir la connexion

### Format des events SSE

```
event: reminder
id: <reminder-id>
data: {"id":"...","eventId":"...","minutesBefore":15,"scheduledAt":"..."}

event: heartbeat
data:
```

### Reconnexion

- Si la connexion est coupee, EventSource se reconnecte automatiquement
- A la reconnexion, tous les reminders pending non-ack sont renvoyes
- Donc : aucun reminder n'est perdu meme si l'app est fermee/redemarree

## Comportement attendu

- `scheduledAt` est calcule cote API : `event.startAt - (minutesBefore * 60s)`
- Quand un event est modifie (changement de startAt), l'API recalcule les scheduledAt
- Le endpoint `/api/reminders/pending` reste disponible comme fallback
- Cote API : un job verifie la DB toutes les 30s et emet les pending sur le stream SSE
- Cote client : ecoute SSE, envoie ack apres affichage de la notification

## Implementation Android recommandee

### SSE avec OkHttp

```kotlin
// OkHttp SSE client (recommande pour Android)
val request = Request.Builder()
    .url("$API_BASE/sse")
    .build()

val sse = OkSse(client).newServerSentEvent(request, object : ServerSentEvent.Listener {
    override fun onMessage(sse: ServerSentEvent, id: String?, event: String?, data: String) {
        if (event == "reminder") {
            val reminder = json.decodeFromString<Reminder>(data)
            showNotification(reminder)
            ackReminder(reminder.id)
        }
    }
    override fun onClosed(sse: ServerSentEvent) { reconnect() }
})
```

### Notifications Android natives
- Utiliser `NotificationCompat.Builder` avec channel "do-it-now-reminders"
- Channel dedie avec priorite HIGH
- Notification avec actions : "Voir", "Reporter 5min", "Ignorer"

### Arriere-plan
- Foreground Service avec notification persistante pour maintenir le SSE actif
- Quand l'app est killed : WorkManager en fallback (polling `/api/reminders/pending` toutes les 15min)
- A la reouverture de l'app : reconnexion SSE + fetch pending pour rattraper les manques

### Gestion batterie
- Respecter les restrictions Doze mode
- Le Foreground Service maintient le SSE meme en Doze
- Fallback WorkManager si le service est tue par le systeme
- Respecter les parametres Do Not Disturb
