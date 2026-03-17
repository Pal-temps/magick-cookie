# Roadmap — Features developpeur

Features orientees productivite dev, a ajouter a l'app existante.

---

## Etat actuel

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 1 | Command Palette (Ctrl+K) | ✅ Phase 1-3 done | Historique, bookmarks go:, recherche. Reste: icones SVG |
| 2 | Brief quotidien | ✅ Phase 1-2 done, phase 4 done | BriefView + templates custom (BriefSettings). Reste: phase 3 (git scan) |
| 3 | Time Tracking par tache | ✅ Phase 1-4 done | Analytics par tache (TaskTimeChart), timesheet (TimesheetView), time-by-project |
| 4 | Bookmarks | ✅ Done | CRUD API + sidebar favoris + command palette go: + BookmarkSettings |
| 5 | Projects | ✅ Done | CRUD API + timer projectId + time-by-project analytics + ProjectSettings |
| 6 | Smart Reminders | ✅ Done | Alertes stale tasks, untriaged, unread emails + polling 1h |
| 7 | Streak tracker | ✅ Done | StreakWidget avec contribution graph 30j |
| 8 | Patterns de productivite | ✅ Done | PatternsView (hourly/weekday distribution) |
| 9 | Theme auto jour/nuit | ✅ Done | ThemeSwitcher (manual/auto-system/auto-schedule) + 3 themes |
| 10 | Focus Mode | ✅ Done | FocusOverlay + auto-toggle avec timer |
| 11 | Quick Capture | ✅ Done | QuickCapture (Win+Shift+N) + global shortcuts |
| 12 | VPS Monitoring | ✅ Done | VpsWidget + VpsView + VpsSettings |
| 13 | GitHub PR watcher | ✅ Done | GitHubWidget + GitHubSettings |
| 14 | Chat LLM | ✅ Done | ChatView + chatStore |

---

## Plan de developpement

Organise en sprints de complexite croissante. Chaque sprint est independant mais les features s'enrichissent mutuellement.

### Sprint 1 — Quick wins (100% frontend, 0 migration) ✅ DONE

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 4 | Command Palette polish | ✅ Done | Historique, bookmarks go:, scoring |
| 5 | Theme automatique jour/nuit | ✅ Done | ThemeSwitcher 3 modes + 3 themes |
| 6 | Streak tracker | ✅ Done | StreakWidget + contribution graph |

---

### Sprint 2 — Capture rapide + Focus (Tauri plugins) ✅ DONE

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 7 | Quick Capture (Win+Shift+N) | ✅ Done | QuickCapture.tsx + global shortcut listener |
| 8 | Focus Mode | ✅ Done | FocusOverlay + auto-toggle timer + Escape exit |
| 9 | Raccourcis globaux Windows | ✅ Done | Win+Shift+T/B/D dans App.tsx |

---

### Sprint 3 — Intelligence sur les donnees (LLM + analytics) — Majoritairement DONE

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 10 | Git activity scan (Brief phase 3) | ❌ A faire | Seule feature restante du sprint |
| 11 | Analytics par tache (Time Tracking phase 3) | ✅ Done | TaskTimeChart + time-by-task endpoint |
| 12 | Patterns de productivite | ✅ Done | PatternsView (hourly/weekday + trends) |
| 13 | Auto-triage suggestions | ❌ A faire | LLM + triage integration |
| 14 | Chat LLM | ✅ Done | ChatView + chatStore + conversations |

---

### Sprint 4 — Integrations externes + polish — Majoritairement DONE

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 15 | GitHub PR watcher | ✅ Done | GitHubWidget + GitHubSettings |
| 16 | Resume hebdo email | ❌ A faire | LLM + email digest |
| 17 | Clipboard history | ✅ Done | clipboardStore + command palette clip: |
| 18 | Vue timesheet (Time Tracking phase 4) | ✅ Done | TimesheetView avec ISO weeks |

---

### Sprint 5 — Notes avancees + templates — Partiellement DONE

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 19 | Wiki-links dans les notes | ❌ A faire | Parser [[...]] + autocomplete + backlinks |
| 20 | Brief templates customisables (phase 4) | ✅ Done | BriefSettings + presets + custom templates |

---

## Detail des features

---

### 4. Command Palette — Phase 3 polish

**Objectif :** Rendre la palette plus rapide et agreable a utiliser au quotidien.

**Ajouts :**
- Icones par categorie (emoji ou SVG inline) : 📋 taches, 📅 events, 📧 emails, 👤 contacts, ⚡ actions
- Historique des 10 dernieres commandes executees (localStorage), affiche quand query vide
- Raccourcis clavier affiches a droite des actions (ex: "Ctrl+N" a cote de "Nouvel evenement")
- Recherche dans les notes via `invoke("notes_list")` avec prefix `n:`

**Fichiers a modifier :**
| Fichier | Changement |
|---------|------------|
| `commandStore.ts` | Historique localStorage, recherche notes, icones dans le registry |
| `CommandPalette.tsx` | Affichage icones, section historique, badges raccourcis |

---

### 5. Theme automatique jour/nuit

**Objectif :** Basculer automatiquement entre theme clair et sombre selon l'heure (ou coucher/lever du soleil).

**UX :**
- Settings : choix entre "Clair", "Sombre", "Auto (horaire)", "Auto (systeme)"
- Mode horaire : configurable (ex: sombre 20h-7h)
- Mode systeme : `prefers-color-scheme` media query

**Architecture :**
- 100% frontend
- Stocker le mode dans localStorage
- Interval qui verifie toutes les minutes en mode horaire
- `window.matchMedia("(prefers-color-scheme: dark)")` en mode systeme

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Modifier | `ThemeSwitcher.tsx` — ajouter les modes auto |
| Modifier | `SettingsView.tsx` — config horaires jour/nuit |

---

### 6. Streak tracker

**Objectif :** Afficher la serie de jours consecutifs avec du focus time. Gamification legere mais motivante.

**UX :**
- Widget dashboard : flamme + nombre de jours consecutifs
- Tooltip : "12 jours consecutifs de focus !"
- Seuil configurable (defaut: 1 session minimum par jour)
- Mini calendrier "contribution graph" style GitHub (30 derniers jours, couleur = intensite)

**Architecture :**
- Endpoint : `GET /api/analytics/streak` → `{ currentStreak: number, longestStreak: number, last30Days: { date: string, totalSeconds: number }[] }`
- Reutilise `timerSessionRepo.getDailyStats(from, to)`

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/ui/components/dashboard/StreakWidget.tsx` |
| Modifier | `analytics.service.ts` — methode `getStreak()` |
| Modifier | `analytics.routes.ts` — route `/streak` |
| Modifier | `analyticsStore.ts` — signal streak |
| Modifier | `DashboardView.tsx` — ajouter le widget |

---

### 7. Quick Capture (Win+Shift+N)

**Objectif :** Capturer une pensee/tache/note en 2 secondes sans quitter son contexte. Hotkey global, meme quand l'app est en arriere-plan.

**UX :**
- `Win+Shift+N` → petit popup flottant (300x150px) au centre de l'ecran
- Champ texte auto-focus
- Enter → sauvegarde comme tache "manual" dans l'inbox (status "open", source "manual")
- Shift+Enter → sauvegarde comme note rapide
- Escape → ferme sans sauvegarder
- Le popup disparait apres sauvegarde (feedback visuel 500ms)

**Architecture :**
- Tauri : `tauri-plugin-global-shortcut` pour le hotkey
- Nouveau window Tauri "capture" (petite, toujours au premier plan, transparente)
- API : reutilise `POST /api/tasks` (tache) ou `notes_save` (note)

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/ui/components/capture/QuickCapture.tsx` |
| Modifier | `src-tauri/src/lib.rs` — global shortcut registration |
| Modifier | `src-tauri/capabilities/default.json` — ajouter permissions global-shortcut |
| Modifier | `src-tauri/tauri.conf.json` — declarer la fenetre "capture" |
| Ajouter | `tauri-plugin-global-shortcut` dans Cargo.toml |

---

### 8. Focus Mode

**Objectif :** Quand un Pomodoro tourne, creer un tunnel visuel qui elimine les distractions.

**UX :**
- Activation : automatique au demarrage d'un timer Pomodoro (opt-in dans settings)
- Effet : overlay semi-transparent sur toute l'app sauf le timer + tache en cours
- Sidebar et menus masques / grises
- Notifications email desactivees pendant le focus
- Barre de progression minimaliste en haut
- Desactivation : automatique a la fin du timer, ou manuellement via Escape

**Architecture :**
- Signal global `isFocusMode` dans timerStore
- `<FocusOverlay>` dans App.tsx qui reagit au signal
- CSS : `pointer-events: none` + `opacity: 0.3` sur les zones non-focus
- Suspend le background job email-sync pendant le focus (optionnel)

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/ui/components/common/FocusOverlay.tsx` |
| Modifier | `timerStore.ts` — signal `isFocusMode`, toggle automatique |
| Modifier | `App.tsx` — render FocusOverlay |
| Modifier | `SettingsView.tsx` — option "Focus Mode automatique" |

---

### 9. Raccourcis globaux Windows

**Objectif :** Controler l'app sans la fenetre visible. Hotkeys systeme pour les actions frequentes.

**Raccourcis par defaut :**
| Raccourci | Action |
|-----------|--------|
| `Win+Shift+N` | Quick Capture (voir #7) |
| `Win+Shift+T` | Start/stop timer |
| `Win+Shift+B` | Afficher le brief du jour |
| `Win+Shift+D` | Toggle mode bureau |

**Architecture :**
- `tauri-plugin-global-shortcut`
- Enregistrement dans `lib.rs` au setup
- Emit events vers le frontend via `app.emit("global-shortcut", payload)`
- Frontend ecoute et execute les actions

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Modifier | `src-tauri/src/lib.rs` — enregistrer les shortcuts |
| Modifier | `App.tsx` — listener `global-shortcut` event |
| Modifier | `SettingsView.tsx` — configuration des raccourcis |
| Ajouter | `tauri-plugin-global-shortcut` dans Cargo.toml |

**Note :** Mutualisé avec Quick Capture (#7) — implementer ensemble.

---

### 10. Git activity scan (Brief phase 3)

**Objectif :** Scanner des repos git locaux pour enrichir le brief avec les commits recents.

**UX :**
- Settings : configurer 1-N chemins de repos git locaux
- Le brief inclut automatiquement les commits des dernieres 24h
- Section "Code" dans le brief : "3 commits sur magick-cookie, 1 PR mergee sur vps-api"

**Architecture :**
- Backend : nouveau service `GitScanService`
  - Execute `git log --since="yesterday" --oneline --author="<user>"` sur chaque repo configure
  - Parse les lignes en `{ hash, message, repo }`
- Stockage config : table `settings` ou `git_repos` (simple clé-valeur)
- Integration dans `BriefService.collectData()` : ajoute une section `git` dans rawData

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/api/src/application/git/git-scan.service.ts` |
| Modifier | `brief.service.ts` — ajouter git data dans collectData |
| Modifier | `SettingsView.tsx` — config repos git |
| Creer | Migration `0011_git_repos_config.sql` ou utiliser localStorage cote frontend |

---

### 11. Analytics par tache (Time Tracking phase 3)

**Objectif :** Voir la repartition du temps par tache dans les analytics et le weekly review.

**UX :**
- StatsView : nouveau graphique "Temps par tache" — bar chart horizontal
- Weekly review : section "Top 5 taches par temps investi"
- Filtre par periode (semaine, mois)

**Architecture :**
- Backend : `analyticsService.getTimeByTask(from, to)` → `{ taskId, taskTitle, totalSeconds }[]`
  - SQL : `SELECT task_id, SUM(actual_seconds) FROM timer_sessions WHERE ... GROUP BY task_id`
  - Join avec tasks pour le titre
- Frontend : nouveau composant `TaskTimeChart.tsx` (bar chart CSS simple)

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/ui/components/dashboard/TaskTimeChart.tsx` |
| Modifier | `analytics.service.ts` — methode `getTimeByTask()` |
| Modifier | `analytics.routes.ts` — route `/time-by-task` |
| Modifier | `StatsView.tsx` — integrer le chart |
| Modifier | `analyticsStore.ts` — signal timeByTask |

---

### 12. Patterns de productivite

**Objectif :** Detecter automatiquement les patterns dans les donnees timer pour montrer quand on est le plus productif.

**UX :**
- Widget dashboard ou section dans StatsView
- "Tes heures les plus productives : 9h-11h et 14h-16h"
- "Mardi et jeudi sont tes jours les plus focuses"
- "Ta duree de focus moyenne augmente de 12% cette semaine"
- Heatmap heures × jours (style GitHub mais pour le focus)

**Architecture :**
- Backend : `analyticsService.getProductivityPatterns(from, to)`
  - Agrege timer sessions par heure du jour et jour de la semaine
  - Calcule moyennes, tendances, top heures/jours
- Retourne : `{ hourlyDistribution: { hour: number, avgMinutes: number }[], weekdayDistribution: { day: number, avgMinutes: number }[], trend: number }`

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/ui/components/dashboard/PatternsView.tsx` |
| Modifier | `analytics.service.ts` — methode `getProductivityPatterns()` |
| Modifier | `analytics.routes.ts` — route `/patterns` |
| Modifier | `DashboardView.tsx` — bouton "Patterns" ou widget |

---

### 13. Auto-triage suggestions

**Objectif :** Le LLM analyse les taches non triees et propose un triage automatique.

**UX :**
- Bouton "Auto-triage" dans TriageView quand il y a des taches non triees
- Le LLM recoit : titre, description, labels, anciennete, source
- Propose : priority / later / archived avec une raison courte
- L'utilisateur valide ou corrige chaque suggestion (swipe comme d'hab)

**Architecture :**
- Backend : `POST /api/triage/suggest` → envoie les taches non triees au LLM
- Prompt : "Voici des taches de dev. Classe chaque tache en priority/later/archived. Reponds en JSON."
- Frontend : mode "suggestion" dans TriageView avec badge "IA" sur chaque carte

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Modifier | `triage.service.ts` — methode `suggestTriage()` |
| Modifier | `triage.routes.ts` — route `POST /suggest` |
| Modifier | `TriageView.tsx` — bouton auto-triage + mode suggestion |
| Modifier | `triageStore.ts` — signal suggestions |

---

### 14. Chat LLM

**Objectif :** Interface de conversation avec le LLM configure (local via Ollama/LM Studio ou cloud via API key). Poser des questions, demander de l'aide, brainstormer — sans quitter l'app.

**UX :**
- Nouvelle vue "Chat" accessible depuis la sidebar / command palette / raccourci
- Interface classique de chat : messages utilisateur a droite, reponses LLM a gauche
- Historique des conversations persiste (DB)
- Markdown rendu dans les reponses (code blocks, listes, gras)
- Contexte optionnel : attacher une tache, un email, ou une note a la conversation pour que le LLM ait le contexte
- Boutons rapides : "Resume cette tache", "Aide-moi a rediger", "Explique ce blocage"
- Streaming des reponses (si le provider le supporte)

**Architecture :**

**Backend :**
- Nouvelle table `chat_conversations` : `{ id, title, createdAt, updatedAt }`
- Nouvelle table `chat_messages` : `{ id, conversationId, role, content, createdAt }`
- `ChatService` :
  - `createConversation()` → nouvelle conversation
  - `listConversations()` → historique
  - `getMessages(conversationId)` → messages d'une conversation
  - `sendMessage(conversationId, content, context?)` → envoie au LLM, sauvegarde la reponse
  - Reutilise `LlmService.chat()` avec l'historique des messages de la conversation
- Routes :
  - `GET /api/chat` → liste des conversations
  - `POST /api/chat` → creer une conversation
  - `GET /api/chat/:id/messages` → messages
  - `POST /api/chat/:id/messages` → envoyer un message
  - `DELETE /api/chat/:id` → supprimer une conversation

**Frontend :**
- `ChatView.tsx` : vue principale avec sidebar conversations + zone de chat
- `chatStore.ts` : gestion des conversations, messages, envoi
- Integration dans la command palette : "> Chat" pour ouvrir
- ViewMode : ajouter `"chat"` au type ViewMode

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/api/src/application/chat/chat.service.ts` |
| Creer | `apps/api/src/domain/chat/chat.entity.ts` |
| Creer | `apps/api/src/domain/chat/chat.repository.ts` |
| Creer | `apps/api/src/infrastructure/repositories/chat.repository.impl.ts` |
| Creer | `apps/api/src/presentation/routes/chat.routes.ts` |
| Creer | `apps/desktop/src/ui/components/chat/ChatView.tsx` |
| Creer | `apps/desktop/src/application/stores/chatStore.ts` |
| Creer | Migration `0011_chat.sql` (ou 0012 selon l'ordre) |
| Modifier | `apps/api/src/index.ts` — wiring ChatService + routes |
| Modifier | `apps/api/src/infrastructure/database/schema.ts` — tables chat |
| Modifier | `apps/desktop/src/application/stores/viewStore.ts` — ajouter "chat" au ViewMode |
| Modifier | `apps/desktop/src/App.tsx` — render ChatView |
| Modifier | `commandStore.ts` — action "Chat" dans la palette |

---

### 15. GitHub PR watcher

**Objectif :** Suivre les PRs ouvertes, les reviews demandees, les merges. Widget dashboard.

**UX :**
- Settings : configurer un token GitHub + repos a suivre
- Widget dashboard : liste des PRs ouvertes avec statut (draft, review, approved, merged)
- Badge rouge quand une review est demandee
- Clic → ouvre la PR dans le navigateur
- Notif push quand une PR change de statut

**Architecture :**
- Backend : nouveau connecteur GitHub API (REST ou GraphQL)
  - `GET /api/github/prs` → PRs ouvertes sur les repos configures
  - Background job : poll toutes les 5 minutes
  - Stockage : table `github_prs` pour le cache + diff de statut
- Frontend : `GitHubWidget.tsx` dans le dashboard

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/api/src/application/github/github.service.ts` |
| Creer | `apps/api/src/presentation/routes/github.routes.ts` |
| Creer | `apps/desktop/src/ui/components/dashboard/GitHubWidget.tsx` |
| Creer | `apps/desktop/src/application/stores/githubStore.ts` |
| Creer | Migration `github_prs` + `github_config` |
| Modifier | `index.ts` — wiring |
| Modifier | `SettingsView.tsx` — config GitHub |
| Modifier | `DashboardView.tsx` — widget |

---

### 16. Resume hebdo email

**Objectif :** Digest LLM des emails importants de la semaine.

**UX :**
- Bouton "Digest" dans EmailView
- Le LLM resume les emails non lus / starred de la semaine
- Groupes par expediteur ou sujet
- "3 emails de OVH → factures en attente", "2 de GitHub → PR reviews"

**Architecture :**
- Backend : `GET /api/emails/digest?days=7`
  - Recupere les emails non lus + starred des N derniers jours
  - Envoie au LLM : sujets, expediteurs, extraits body
  - Retourne un resume structure
- Frontend : overlay dans EmailView

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Modifier | `email.service.ts` — methode `getDigest()` |
| Modifier | `email.routes.ts` — route `/digest` |
| Creer | `apps/desktop/src/ui/components/email/EmailDigest.tsx` |
| Modifier | `EmailView.tsx` — bouton Digest |

---

### 17. Clipboard history

**Objectif :** Garder les 20 derniers elements copies, accessibles via la command palette.

**UX :**
- La command palette avec prefix `clip:` affiche l'historique
- Clic ou Enter → colle dans le presse-papier actif
- Fonctionne pour texte uniquement
- Stockage en memoire (pas persiste, reset au redemarrage)

**Architecture :**
- Tauri : `tauri-plugin-clipboard-manager` pour listener les changements
- Frontend : `clipboardStore.ts` maintient un ring buffer de 20 items
- Integration dans commandStore : source "Clipboard" quand query commence par `clip:`

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/application/stores/clipboardStore.ts` |
| Modifier | `commandStore.ts` — source clipboard |
| Modifier | `src-tauri/Cargo.toml` — plugin clipboard |
| Modifier | `src-tauri/capabilities/default.json` — permissions |

---

### 18. Vue timesheet (Time Tracking phase 4)

**Objectif :** Tableau recapitulatif jour × tache pour visualiser ou va le temps.

**UX :**
- Accessible depuis StatsView ou comme vue dediee
- Grille : colonnes = jours de la semaine, lignes = taches
- Cellules : duree en heures (colorie par intensite)
- Total par ligne (tache) et par colonne (jour)
- Export CSV optionnel

**Architecture :**
- Backend : `GET /api/analytics/timesheet?week=2026-W12` → `{ rows: { taskId, taskTitle, days: { [date]: seconds } }[] }`
- Frontend : composant tableau HTML simple

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Creer | `apps/desktop/src/ui/components/dashboard/TimesheetView.tsx` |
| Modifier | `analytics.service.ts` — methode `getTimesheet()` |
| Modifier | `analytics.routes.ts` — route `/timesheet` |
| Modifier | `DashboardView.tsx` ou `StatsView.tsx` — acces |

---

### 19. Wiki-links dans les notes

**Objectif :** Permettre de lier les notes entre elles avec la syntaxe `[[nom de la note]]`.

**UX :**
- Taper `[[` dans l'editeur → autocomplete avec la liste des notes
- Clic sur un lien → ouvre la note cible
- Lien mort (note supprimee) → affiche en rouge
- Backlinks : en bas de chaque note, liste des notes qui pointent vers elle

**Architecture :**
- Frontend : parser le contenu pour detecter `[[...]]`, transformer en liens cliquables
- Backend : optionnel — index de backlinks pour performance (ou calcul cote client)

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Modifier | `NotesEditor` (ou le composant d'edition actuel) — parser + autocomplete |
| Modifier | `NotesView.tsx` — navigation sur clic lien + section backlinks |

---

### 20. Brief templates customisables (Brief phase 4)

**Objectif :** Permettre de changer le format, la langue, et les sections du brief.

**UX :**
- Settings : editeur de template (prompt systeme)
- Presets : "Standup FR", "Standup EN", "Rapport manager", "Changelog"
- Variables disponibles : `{yesterday}`, `{today}`, `{blockers}`, `{git}`, `{emails}`

**Architecture :**
- Stocker les templates en DB ou localStorage
- BriefService utilise le template selectionne au lieu du prompt hardcode

**Fichiers :**
| Action | Fichier |
|--------|---------|
| Modifier | `brief.service.ts` — charger template dynamique |
| Modifier | `SettingsView.tsx` — editeur de templates |
| Creer | Migration ou localStorage pour stocker les templates |

---

## Ordre d'implementation — Restant

```
Prochain :
  3. Raccourcis clavier Email (roadmap-next-features #3)  ← rapide, QoL
  5. Resume email par IA (roadmap-next-features #5)       ← reutilise LLM existant
  10. Git activity scan (Brief phase 3)                   ← enrichit le brief
  13. Auto-triage suggestions                             ← LLM + triage
  16. Resume hebdo email                                  ← LLM + email digest
  19. Wiki-links dans les notes                           ← parser + autocomplete
```

---

## Bilan

| Sprint | Features | Statut |
|--------|----------|--------|
| 1 | 3 | ✅ 3/3 done |
| 2 | 3 | ✅ 3/3 done |
| 3 | 5 | 3/5 done (reste: git scan, auto-triage) |
| 4 | 4 | 3/4 done (reste: resume hebdo email) |
| 5 | 2 | 1/2 done (reste: wiki-links) |
| **Total** | **17** | **13/17 done — 4 restantes** |

---

## Notes techniques

- **Plugins Tauri requis** : `tauri-plugin-global-shortcut` (sprints 2), `tauri-plugin-clipboard-manager` (sprint 4)
- **Toutes les features API sont compatibles mobile** — les endpoints REST sont reutilisables
- **LLM optionnel partout** — chaque feature avec LLM a un fallback sans LLM
- **Pas de breaking changes DB** — toutes les migrations sont additives (ADD COLUMN, nouvelles tables)
