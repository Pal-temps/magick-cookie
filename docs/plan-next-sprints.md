# Plan — Sprints 8-11 (COMPLETS)

> **Note :** Tous les sprints 8 a 11 sont implementes et livres. Ce document sert de reference pour les features #29-#42.

Features implementees, organisees par sprint. Numerotation continue depuis le #28.

---

## Sprint 8 — Kanban & Dashboard ✅ DONE

### #29 Kanban Board ✅

**Description :** Vue visuelle des taches en colonnes drag & drop (Backlog → En cours → Done → Archive). Cartes avec titre, priorite, labels, assignee. Filtre par projet.

**Tables :** Aucune nouvelle — reutilise `tasks` + `task_triage` (le statut triage mappe sur les colonnes)

**Fichiers :**
- `apps/desktop/src/ui/components/triage/KanbanView.tsx` — vue Kanban
- `apps/desktop/src/application/stores/triageStore.ts` — ajouter drag & drop update
- `apps/api/src/presentation/routes/triage.routes.ts` — endpoint batch update statuts

**Complexite :** Moyenne | **Priorite :** P1

---

### #30 Dashboard Widgets Configurables ✅

**Description :** Widgets du dashboard reordonnables par drag & drop. L'utilisateur choisit quels widgets afficher et dans quel ordre. Persistance en localStorage.

**Tables :** Aucune

**Fichiers :**
- `apps/desktop/src/ui/components/dashboard/DashboardView.tsx` — refactor en widgets dynamiques
- `apps/desktop/src/application/stores/dashboardStore.ts` — config widgets (ordre, visibilite)

**Complexite :** Moyenne | **Priorite :** P2

---

## Sprint 9 — Dev Tools ✅ DONE

### #31 Snippets / Code Clipboard ✅

**Description :** Stocker des bouts de code, commandes, templates reutilisables. Syntaxe highlighting, categories, recherche. Accessible via command palette (`snip:` prefix).

**Tables :**
- `snippets` (id, title, content, language, category, tags, is_favorite, created_at, updated_at)
- `snippet_categories` (id, value, label, sort_order, created_at)

**Fichiers :**
- `apps/api/src/domain/snippet/` — entity + repository
- `apps/api/src/infrastructure/repositories/snippet.repository.impl.ts`
- `apps/api/src/application/snippet/snippet.service.ts`
- `apps/api/src/presentation/routes/snippet.routes.ts`
- `apps/desktop/src/application/stores/snippetStore.ts`
- `apps/desktop/src/ui/components/snippets/SnippetView.tsx`
- Integration command palette avec prefix `snip:`

**Complexite :** Moyenne | **Priorite :** P1

---

### #32 Dashboard CI/CD ✅

**Description :** Afficher le statut des pipelines GitHub Actions (et optionnellement GitLab CI). Derniers runs, statut (success/failure/running), lien vers le run. Widget dashboard + vue dediee.

**Tables :**
- Pas de table — fetch en temps reel depuis l'API GitHub (reutilise le token GitHub existant)

**Fichiers :**
- `apps/api/src/application/github/github.service.ts` — ajouter `getWorkflowRuns(repo)`
- `apps/api/src/presentation/routes/github.routes.ts` — endpoint `GET /github/runs`
- `apps/desktop/src/ui/components/dashboard/CiCdWidget.tsx`
- `apps/desktop/src/ui/components/github/CiCdView.tsx` (optionnel)

**Complexite :** Faible | **Priorite :** P2

---

### #33 Environment Checker ✅

**Description :** Verifier le statut des services locaux (Docker running, PostgreSQL up, API health, ports ouverts). Affiche un dashboard sante de l'environnement dev.

**Tables :** Aucune — checks locaux

**Fichiers :**
- `apps/desktop/src-tauri/src/env_check.rs` — commandes Tauri pour check ports/processes
- `apps/desktop/src/application/stores/envStore.ts`
- `apps/desktop/src/ui/components/dashboard/EnvWidget.tsx`

**Complexite :** Moyenne | **Priorite :** P3

---

### #34 Changelog Generator ✅

**Description :** Generer un changelog depuis les commits git d'un repo via le LLM. Selectionner un repo, une plage de dates, le LLM redige un changelog structure (features, fixes, breaking changes).

**Tables :** Aucune — utilise GitScanService + LlmService

**Fichiers :**
- `apps/api/src/application/changelog/changelog.service.ts` — scan git + prompt LLM
- `apps/api/src/presentation/routes/changelog.routes.ts` — `POST /changelog/generate`
- `apps/desktop/src/ui/components/tools/ChangelogGenerator.tsx`

**Complexite :** Faible | **Priorite :** P3

---

## Sprint 10 — Calendar & Automation ✅ DONE

### #35 CalDAV Sync (Google Calendar / Outlook) ✅

**Description :** Synchroniser des calendriers externes via le protocole CalDAV. Import bidirectionnel des evenements. Support Google Calendar et Outlook via leurs URLs CalDAV.

**Tables :**
- `caldav_accounts` (id, label, url, username, password_enc, calendar_id_local, last_synced_at, sync_enabled)

**Fichiers :**
- `apps/api/src/infrastructure/connectors/caldav.connector.ts` — lib `tsdav` ou `dav`
- `apps/api/src/application/calendar/caldav-sync.service.ts`
- `apps/api/src/infrastructure/jobs/caldav-sync.job.ts`
- `apps/desktop/src/ui/components/settings/CalDavSettings.tsx`

**Dependances :** Package npm `tsdav`

**Complexite :** Haute | **Priorite :** P2

---

### #36 Email Rules (Auto-classification) ✅

**Description :** Regles automatiques sur les emails entrants. Conditions : expediteur, sujet contient, domaine. Actions : classifier, tagger, archiver. Executees a chaque sync.

**Tables :**
- `email_rules` (id, name, conditions JSON, action, action_value, enabled, sort_order, created_at)

**Fichiers :**
- `apps/api/src/domain/email/email-rule.entity.ts`
- `apps/api/src/infrastructure/repositories/email-rule.repository.impl.ts`
- `apps/api/src/application/email/email-rule.service.ts`
- `apps/api/src/application/email/email.service.ts` — appliquer les regles apres sync
- `apps/desktop/src/ui/components/settings/EmailRuleSettings.tsx`

**Complexite :** Moyenne | **Priorite :** P2

---

### #37 Routines ✅

**Description :** Sequences d'actions programmees. Ex: routine "Matin" a 8h → genere brief + sync emails + ouvre dashboard. Routine "Soir" a 17h → affiche timesheet + weekly check.

**Tables :**
- `routines` (id, name, trigger_time, trigger_days, steps JSON, enabled, created_at)

**Fichiers :**
- `apps/api/src/domain/routine/routine.entity.ts`
- `apps/api/src/infrastructure/repositories/routine.repository.impl.ts`
- `apps/api/src/application/routine/routine.service.ts`
- `apps/desktop/src/application/stores/routineStore.ts` — checker client-side (comme alarms)
- `apps/desktop/src/ui/components/settings/RoutineSettings.tsx`

**Complexite :** Haute | **Priorite :** P3

---

### #38 Webhooks Entrants ✅

**Description :** Recevoir des notifications de services externes (GitHub Actions, Sentry, custom). Endpoint generique qui stocke les payloads et les affiche comme notifications.

**Tables :**
- `webhooks` (id, name, secret, source, enabled, created_at)
- `webhook_events` (id, webhook_id, payload JSON, received_at, read_at)

**Fichiers :**
- `apps/api/src/domain/webhook/webhook.entity.ts`
- `apps/api/src/infrastructure/repositories/webhook.repository.impl.ts`
- `apps/api/src/presentation/routes/webhook.routes.ts` — `POST /webhooks/:id/receive`
- `apps/desktop/src/ui/components/settings/WebhookSettings.tsx`

**Complexite :** Moyenne | **Priorite :** P3

---

## Sprint 11 — Bien-etre & UX ✅ DONE

### #39 Custom Habit Tracker ✅

**Description :** Au-dela de l'eau et des fruits, tracker des habitudes personnalisees (sport, lecture, meditation, etc.) avec objectifs, streaks, et graphiques. L'utilisateur definit ses habitudes.

**Tables :**
- Reutilise `wellness_configs` + `wellness_logs` — ajouter des types custom au lieu des types fixes

**Fichiers :**
- `apps/api/src/application/wellness-config/wellness-config.service.ts` — permettre types custom
- `apps/desktop/src/ui/components/wellness/HabitSettings.tsx` — CRUD habitudes custom
- `apps/desktop/src/ui/components/dashboard/HabitWidget.tsx`

**Complexite :** Faible | **Priorite :** P1

---

### #40 Daily Journal ✅

**Description :** Note quotidienne auto-creee dans le vault notes, pre-remplie avec les donnees du brief (focus, events, taches). Format : `journal/YYYY-MM-DD.md`.

**Tables :** Aucune — fichiers dans le vault git

**Fichiers :**
- `apps/desktop/src/application/stores/journalStore.ts` — generer + sauver dans vault
- Integration avec `notesStore.ts` (invoke notes_save)
- Integration avec `briefService` pour les donnees du jour
- Bouton "Journal du jour" dans le dashboard

**Complexite :** Faible | **Priorite :** P1

---

### #41 Raccourcis Globaux Personnalisables ✅

**Description :** L'utilisateur configure ses propres raccourcis clavier pour n'importe quelle action (ouvrir une vue, lancer un pomodoro, sync, etc.). Stocke en DB ou localStorage.

**Tables :**
- `user_shortcuts` (id, action, shortcut, enabled) — ou localStorage

**Fichiers :**
- `apps/desktop/src/application/stores/shortcutStore.ts` — registre d'actions + raccourcis
- `apps/desktop/src/ui/components/settings/ShortcutSettings.tsx`
- `apps/desktop/src/App.tsx` — handler dynamique

**Complexite :** Moyenne | **Priorite :** P2

---

### #42 Mode Offline ✅

**Description :** Quand l'API est inaccessible, les actions sont mises en queue localement (IndexedDB ou fichier). Au retour de la connexion, la queue est rejouee automatiquement.

**Tables :** Aucune cote serveur — stockage local IndexedDB

**Fichiers :**
- `apps/desktop/src/infrastructure/offline/offlineQueue.ts` — queue + replay
- `apps/desktop/src/infrastructure/api/apiClient.ts` — wrapper qui detecte offline
- `apps/desktop/src/ui/components/common/OfflineIndicator.tsx`

**Complexite :** Haute | **Priorite :** P3

---

## Resume

| Sprint | Features | Statut |
|--------|----------|--------|
| 8 | Kanban + Dashboard widgets (2) | ✅ Done |
| 9 | Snippets + CI/CD + Env checker + Changelog (4) | ✅ Done |
| 10 | CalDAV + Email rules + Routines + Webhooks (4) | ✅ Done |
| 11 | Habits + Journal + Shortcuts + Offline (4) | ✅ Done |
| **Total** | **14 features** | **✅ 14/14 done** |
