# Wellness & Timer — Mobile Spec

## Timer

### Modes
- **Pomodoro** : 25min focus → 5min pause → 25min focus → ... → 15min longue pause (toutes les 4 sessions)
- **Timer libre** : durée configurable (1-180 min)

### API Endpoints
- `POST /api/timer-sessions` — sauvegarder une session terminée
  - Body: `{ mode, durationMinutes, actualSeconds, startedAt, endedAt, completed?, label? }`
- `GET /api/timer-sessions?from=&to=` — historique avec filtre date
- `GET /api/timer-sessions/stats/today` — `{ totalSeconds, sessionCount }`

### Comportement
- Le timer tourne côté client (tick/seconde)
- La session est sauvée en API quand le timer se termine ou est arrêté
- En mode pomodoro, transition auto focus → break → focus
- Le mini-timer est visible dans le header sur toutes les vues

---

## Bien-être (Wellness)

### Rappels configurables
| Type | Label par défaut | Intervalle | Actif par défaut |
|------|-----------------|------------|-----------------|
| water | Boire de l'eau | 45 min | oui |
| break | Faire une pause | 90 min | oui |
| stretch | S'étirer | 60 min | non |
| breathe | Respirer profondément | 120 min | non |

### API Endpoints
- `GET /api/wellness-configs` — lister toutes les configs
- `POST /api/wellness-configs` — créer une config
  - Body: `{ type, label, intervalMinutes, enabled?, alertSound? }`
- `PUT /api/wellness-configs/:id` — modifier (toggle enabled, changer interval, changer son)
  - Body: `{ label?, intervalMinutes?, enabled?, alertSound? }`
- `DELETE /api/wellness-configs/:id` — supprimer

### Sons d'alerte

Chaque rappel peut avoir un son personnalisé (`alertSound`). Sons disponibles :

| Clé | Label | Fichier |
|-----|-------|---------|
| `notification` | Cookie Notification | cookie-notification-v3.mp3 |
| `alarm` | Cookie Boogie | cookie-boogie.mp3 |
| `cockatiel` | Cookie Cockatiel | cookie-cockatiel.mp3 |
| `nomnom` | Nom Nom | nom-nom.mp3 |
| `focusEnd` | Put That Cookie Down | put-that-cookie-down.mp3 |

- Le son est configurable par rappel (select dans le widget + preview)
- Si `alertSound` est `null`, le son par défaut (`notification`) est utilisé
- Le son est joué côté client via `playSound()` au moment de la notification Tauri

### Comportement
- Les rappels tournent en `setInterval` côté client
- Notification native Tauri + son personnalisé quand l'intervalle est atteint
- Fonctionne même app minimisée dans le tray
- Snooze : reporte le prochain rappel de N minutes
- Les configs sont seedées au premier lancement de l'API

---

## Dashboard

- Vue par défaut à l'ouverture de l'app (`viewMode = "dashboard"`)
- Contenu :
  - **TimerWidget** : sélection mode + contrôles + progression circulaire
  - **DailyStats** : temps focus total + nombre de sessions du jour
  - **TodayEvents** : liste des événements du jour
  - **WellnessStatus** : liste des rappels actifs avec toggle et snooze
- Le **MiniTimer** dans le header est visible sur toutes les vues quand un timer est actif

---

## DB Schema

### timer_sessions
| Colonne | Type | Contrainte |
|---------|------|-----------|
| id | uuid | PK |
| mode | varchar(20) | NOT NULL |
| duration_minutes | integer | NOT NULL |
| actual_seconds | integer | NOT NULL |
| started_at | timestamptz | NOT NULL |
| ended_at | timestamptz | NOT NULL |
| completed | boolean | NOT NULL DEFAULT true |
| label | varchar(255) | |
| created_at | timestamptz | NOT NULL DEFAULT now() |

### wellness_configs
| Colonne | Type | Contrainte |
|---------|------|-----------|
| id | uuid | PK |
| type | varchar(50) | NOT NULL UNIQUE |
| label | varchar(255) | NOT NULL |
| interval_minutes | integer | NOT NULL |
| enabled | boolean | NOT NULL DEFAULT true |
| alert_sound | varchar(50) | nullable |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |
