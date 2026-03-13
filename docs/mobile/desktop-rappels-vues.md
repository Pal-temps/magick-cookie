# Spec Mobile — Rappels & Vues avancees (ref desktop)

## Notifications desktop (reference)

Sur desktop (Tauri), les notifications sont declenchees par :
1. Polling `/api/reminders/pending` toutes les 30s
2. Pour chaque reminder pending, envoi d'une notification native via le plugin Tauri notification

## Implementation Android recommandee

### Notifications
- Utiliser `NotificationCompat.Builder` avec channel "do-it-now-reminders"
- Priorite : `PRIORITY_HIGH` pour les rappels
- Actions dans la notification : "Voir l'evenement", "Reporter 5min"
- Icon : icone de l'app
- Vibration pattern court

### Polling en arriere-plan
- Utiliser `WorkManager` avec `PeriodicWorkRequest` (intervalle 15 min minimum Android)
- Alternative : `AlarmManager` pour un polling plus frequent (30s comme desktop)
- En foreground : utiliser un `Handler` / coroutine avec delay 30s
- Gerer correctement le cycle de vie (arreter le polling quand l'app est en background si on utilise AlarmManager)

### Gestion batterie
- Respecter les restrictions Doze mode
- Utiliser `setExactAndAllowWhileIdle` pour les alarmes critiques
- Demander l'exemption de battery optimization a l'utilisateur

## Vue Semaine (mobile)
- Scroll horizontal par jour (pas 7 colonnes comme desktop — trop etroit)
- Ou : afficher 3 jours a la fois en mode paysage
- Grille horaire verticale avec scroll
- Header sticky avec nom du jour + date

## Vue Jour (mobile)
- Identique au desktop mais plein ecran
- Scroll vertical fluide sur les 24h
- Events comme des blocs colores avec hauteur proportionnelle a la duree
- Tap sur un creneau vide = creation rapide d'event a cette heure

## Particularites UX mobile supplementaires
- Animation de transition entre les vues (slide horizontal)
- Haptic feedback sur les interactions importantes (creation, suppression)
- Support mode paysage pour la vue semaine
- Widget Android optionnel : mini vue du jour sur l'ecran d'accueil
