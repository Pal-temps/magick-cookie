# Spec Mobile — Evenements

## Endpoints API

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/events?from=&to=&calendarId=` | Tous les events (filtrables par date range et calendrier) |
| GET | `/api/calendars/:calendarId/events?from=&to=` | Events d'un calendrier specifique |
| GET | `/api/events/:id` | Detail d'un evenement |
| POST | `/api/calendars/:calendarId/events` | Creer un evenement (body peut inclure `reminders[]`) |
| PUT | `/api/events/:id` | Modifier un evenement |
| DELETE | `/api/events/:id` | Supprimer un evenement (cascade reminders) |

## Modele de donnees

```typescript
interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;          // max 500 chars
  description: string | null;
  location: string | null; // max 500 chars
  startAt: string;        // ISO 8601 avec timezone
  endAt: string;
  isAllDay: boolean;
  recurrenceRule: string | null; // iCal RRULE
  createdAt: string;
  updatedAt: string;
}

interface CreateEventDTO {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;  // ISO 8601
  endAt: string;
  isAllDay?: boolean;
  recurrenceRule?: string | null;
  reminders?: { minutesBefore: number }[];
}
```

## Comportement attendu

- Le query `from`/`to` filtre les events dont la plage [startAt, endAt] chevauche [from, to]
- Creation d'event via un calendrier specifique (calendarId dans l'URL)
- Modification du `startAt` recalcule automatiquement les `scheduledAt` des reminders associes
- Suppression cascade les reminders

## Particularites UX mobile

- Formulaire de creation : plein ecran (pas de modal)
- Date/time pickers natifs Android
- Swipe gauche sur un event = option supprimer
- Tap sur un event = detail en bottom sheet
- Tap long = menu contextuel (modifier, supprimer, dupliquer)
- Support du geste "pull to refresh" sur la liste d'events
