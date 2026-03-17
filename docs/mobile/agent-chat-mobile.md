# App Mobile — Agent Chat + Dashboard + Notifications

Spec pour l'app mobile Kotlin Compose qui sert de client leger pour l'agent Magick Cookie.

## Prerequis

- Phase 1 (Agent Core tool-calling) : ✅ Done
- Phase 2 (Scheduler + Push Queue) : ✅ Done
- API endpoints necessaires : `/api/agent/*`, `/api/push/*`, `/api/analytics/*`

## Concept

L'app mobile n'est PAS une replique du desktop. C'est un **client agent-first** avec 3 ecrans :
- Chat agent (interface principale)
- Dashboard compact (resume du jour)
- Notifications (push proactifs de l'agent)

---

## Ecran 1 : Chat Agent (ecran principal)

```
┌─────────────────────────────┐
│  Magick Cookie        [⚙️]  │
├─────────────────────────────┤
│                             │
│  [Agent] Bonjour ! Tu as   │
│  3 taches prio aujourd'hui  │
│  et un streak de 12 jours.  │
│                             │
│         [Toi] Brief         │
│                             │
│  [Agent] ## Hier            │
│  - 3h20 focus, 6 pomodoros  │
│  - Trie 4 taches           │
│  ## Aujourd'hui             │
│  - 2 reunions (14h, 16h30) │
│  - 15 emails non lus       │
│                             │
│     [Toi] Lance un pomo    │
│           sur le projet API │
│                             │
│  [Agent] ✅ Pomodoro        │
│  demarre (25 min) - API    │
│                             │
├─────────────────────────────┤
│  [Message...]        [Envoyer] │
├─────────────────────────────┤
│  💬 Chat   📊 Accueil  🔔 Notifs │
└─────────────────────────────┘
```

- Appelle `POST /api/agent/:id/messages` avec `{ message: "..." }`
- Markdown rendu (gras, listes, titres)
- Boutons rapides en haut : "Brief", "Taches prio", "Streak"

**API :**
- `GET /api/agent` — liste conversations
- `POST /api/agent` — creer conversation
- `GET /api/agent/:id/messages` — historique
- `POST /api/agent/:id/messages` — envoyer message
- `DELETE /api/agent/:id` — supprimer conversation

---

## Ecran 2 : Dashboard compact

```
┌─────────────────────────────┐
│  Mardi 17 mars 2026         │
├─────────────────────────────┤
│  🔥 Streak : 12 jours       │
│  ⏱️ Focus : 2h15 aujourd'hui │
│  📋 3 taches prioritaires   │
│  📧 15 emails non lus       │
├─────────────────────────────┤
│  Prochain event             │
│  14h00 — Reunion equipe     │
├─────────────────────────────┤
│  Brief du jour              │
│  [Voir le brief complet →]  │
├─────────────────────────────┤
│  💬 Chat   📊 Accueil  🔔 Notifs │
└─────────────────────────────┘
```

**API :**
- `GET /api/analytics/streak`
- `GET /api/timer-sessions/stats/today`
- `GET /api/triage?status=priority`
- `GET /api/emails/unread-count`
- `GET /api/events?from=today&to=today`

---

## Ecran 3 : Notifications

```
┌─────────────────────────────┐
│  Notifications               │
├─────────────────────────────┤
│  🔥 Streak en danger !       │
│  17 mars, 17h00              │
│  Ton streak de 12 jours...  │
├─────────────────────────────┤
│  📋 Brief du jour            │
│  17 mars, 08h00              │
│  3h focus hier, 2 reunions..│
├─────────────────────────────┤
│  📧 Inbox deborde            │
│  16 mars, 14h00              │
│  Tu as 23 emails non lus... │
├─────────────────────────────┤
│  💬 Chat   📊 Accueil  🔔 Notifs │
└─────────────────────────────┘
```

**API :**
- `GET /api/push/pending` — non lues
- `GET /api/push?limit=50` — toutes
- `POST /api/push/:id/read` — marquer lue
- `POST /api/push/read-all` — tout marquer lu
- `GET /api/push/stream` — SSE temps reel

---

## Structure du projet

```
apps/mobile/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/magickcookie/
│       │   ├── MainActivity.kt
│       │   ├── data/
│       │   │   ├── api/
│       │   │   │   ├── ApiClient.kt           # Retrofit client
│       │   │   │   ├── AgentApi.kt            # POST /agent/chat
│       │   │   │   ├── AnalyticsApi.kt        # GET /analytics/*
│       │   │   │   └── PushApi.kt             # GET /push/*
│       │   │   └── model/
│       │   │       ├── ChatMessage.kt
│       │   │       ├── StreakData.kt
│       │   │       ├── PushNotification.kt
│       │   │       └── DashboardData.kt
│       │   ├── ui/
│       │   │   ├── theme/
│       │   │   │   └── Theme.kt               # Dark/Light/Cookie
│       │   │   ├── chat/
│       │   │   │   └── ChatScreen.kt
│       │   │   ├── dashboard/
│       │   │   │   └── DashboardScreen.kt
│       │   │   ├── notifications/
│       │   │   │   └── NotificationsScreen.kt
│       │   │   └── settings/
│       │   │       └── SettingsScreen.kt      # Config URL API
│       │   └── worker/
│       │       └── PushPollWorker.kt          # WorkManager polling
│       └── res/
├── build.gradle.kts
└── settings.gradle.kts
```

## Dependances

- `retrofit2` + `moshi` — appels API
- `androidx.compose.*` — UI
- `androidx.work` — WorkManager pour le polling background
- `androidx.navigation.compose` — navigation 3 tabs
- Material 3 avec theme dark personnalise (memes couleurs que le desktop)

## Notifications background

Pas de Firebase/APNs. On utilise :
- `WorkManager` avec `PeriodicWorkRequest` (15-30 min)
- Le worker appelle `GET /api/push/pending`
- Si notifications non lues → `NotificationManager.notify()` locale

## Acces reseau

| Methode | Setup | Hors du reseau local |
|---------|-------|---------------------|
| WiFi local | Rien a faire | Non |
| Tailscale | Installer sur PC + mobile (gratuit, P2P chiffre) | Oui |
| WireGuard | Config VPN maison | Oui |

## Settings

- URL de l'API (ex: `http://192.168.1.42:47300`)
- Intervalle de poll (15/30/60 min)
- Theme (dark/light/cookie)
