# Productivite

> Statut : **Done** — Timer Pomodoro, focus mode, routines, habits, journal, wellness.

Ensemble de features orientees productivite personnelle : timer, habitudes, journal, routines.

## Timer Pomodoro

- Sessions focus/break configurables
- Stats par session (label, duree, complete/abandonne)
- Son en boucle a la fin du focus, dismiss + start break manuels
- Integration projet : `projectId` sur chaque session
- Analytics : temps par tache, par projet, timesheet avec ISO weeks
- Signal global `isFocusMode` pour le focus overlay

### API
```
POST   /api/timer-sessions          # Demarrer/sauver une session
GET    /api/timer-sessions           # Historique (?from, ?to)
GET    /api/analytics/focus          # Stats aggregees
```

## Focus Mode

- Activation automatique au demarrage d'un pomodoro (opt-in settings)
- Overlay semi-transparent sur toute l'app sauf timer + tache en cours
- Sidebar et menus masques/grises (`pointer-events: none` + `opacity: 0.3`)
- Barre de progression minimaliste en haut
- Desactivation : auto fin timer ou Escape manuel
- `FocusOverlay.tsx` dans `App.tsx`

## Routines

- Sequences d'actions programmees (ex: routine "Matin" 8h → brief + sync emails + dashboard)
- Trigger : heure + jours de la semaine
- Steps : JSON array d'actions
- Checker client-side (meme pattern que les alarmes)
- Targets disponibles : brief, sync emails, rss-digest, etc.

### DB
- `routines` (id, name, trigger_time, trigger_days, steps JSON, enabled)

## Custom Habit Tracker

- Habitudes personnalisees au-dela de l'eau/fruits (sport, lecture, meditation...)
- Objectifs configurables, streaks, graphiques
- Reutilise `wellness_configs` + `wellness_logs` avec types custom
- `HabitSettings.tsx` pour CRUD habitudes
- `HabitWidget.tsx` dans le dashboard

## Daily Journal

- Note quotidienne auto-creee dans le vault notes
- Format : `journal/YYYY-MM-DD.md`
- Pre-remplie avec les donnees du brief (focus, events, taches)
- Integration `notesStore.ts` (invoke `notes_save`)
- Bouton "Journal du jour" dans le dashboard

## Wellness

- Trackers configurables : eau, fruits, pauses, stretching...
- Progress bars quotidiennes
- Historique + streaks par habitude
- `wellness_configs` + `wellness_logs` en DB

## Systeme de sons

- `soundPlayer.ts` : notification, focusEnd, alarm
- Son en boucle pour fin de pomodoro
- Sons configurables dans les settings
