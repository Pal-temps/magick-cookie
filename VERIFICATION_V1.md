# Magick Cookie — Checklist de vérification V1

> Cocher chaque case avant de valider la v1 pour publication.
> Lancer d'abord le script automatique : `bun tools/verify-v1/index.ts`

---

## Lancement rapide

```bash
# Démarrer l'app
bun run dev

# Vérification automatique des endpoints
bun tools/verify-v1/index.ts --base http://localhost:3001

# Vérification TypeScript (0 nouvelles erreurs)
rtk tsc --noEmit
```

---

## 🏠 Accueil / Dashboard

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only dashboard` → ✓ 3/3

### Endpoints
- [x] `GET /api/brief/generate` → 200 ✓ (vérifié script)
- [x] `GET /api/analytics?from=…&to=…` → 200 ✓ (vérifié script)
- [x] `GET /api/analytics/streak` → 200 ✓ (vérifié script)

### IA
- [ ] **Brief journalier** : le bouton "Générer" produit un brief lisible
- [ ] **Prévision** : si configurée, la prévision analytique s'affiche

### UI
- [x] État chargement visible — `CookieLoader` dans `AnalyticsWidget` ✓
- [ ] État vide géré (pas de crash si aucune donnée)
- [x] État erreur — ajouté `analyticsError` signal + panel ⚠️ + bouton "Réessayer" dans `AnalyticsWidget` ✓
- [ ] Données se rechargent après retour sur l'onglet

### Notes audit
- ❗ `BriefView` : quelques strings hardcodées FR ("Brief quotidien", "Regenerer") — acceptable v1 (app FR par défaut)
- ❗ Widgets sans état d'erreur visible : `StreakWidget`, `WeeklyReview` — silencieux sur erreur réseau
- ✅ `briefError` signal ajouté dans store (prêt pour utilisation future dans `BriefView`)

---

## 📅 Calendrier

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only calendar` → ✓ 4/4

### Endpoints
- [x] `GET /api/calendars` → 200 ✓
- [x] `GET /api/events` → 200 ✓
- [x] `POST /api/llm/generate-events` → 503 ⚠️ LLM non configuré (route OK, répond correctement)
- [x] `GET /api/caldav-accounts` → 200 ✓

### IA
- [ ] **Génération d'événements** : taper un texte libre → événements créés correctement
- [ ] Indicateur IA visible pendant la génération
- [x] Message d'erreur si LLM non configuré → 503 "LLM not configured" ✓ (était 500)

### UI
- [ ] Navigation entre semaines/mois fluide
- [ ] Création d'événement manuelle fonctionne
- [ ] Drag & drop → vérifier pointer events Tauri
- [ ] Événements CalDAV apparaissent après sync

### Edge cases
- [ ] Semaine sans événements → affichage propre (pas de crash)
- [ ] Fuseau horaire correct

### Corrections apportées
- ✅ `llm.routes.ts` : 4 routes (chat, generate-events, generate-code, test) catchent maintenant "No LLM configured" → 503 au lieu de 500
- ✅ `changelog.routes.ts` : même fix → 503
- ✅ `MonthView.tsx` : noms de jours via `dict().calendar.days` (réactif locale), "+n de plus" i18n
- ✅ `EventForm.tsx` : messages de validation via `t()` (titleRequired, startRequired, endRequired, endAfterStart, calendarRequired)
- ✅ `calendarStore.ts` : anniversaires filtrés si `c.name` null (évite "Anniversaire de null")
- ✅ i18n types/en/fr : 7 nouvelles clés (moreEvents, titleRequired, startRequired, endRequired, endAfterStart, calendarRequired, birthdayOf)

---

## 🤖 Cookia / IDE

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only cookia` → ✓ 4/4

### Endpoints HTTP
- [x] `GET /api/agent` → 200 ✓
- [x] `GET /api/ai/tools` → 200 ✓
- [x] `GET /api/ai/tool-calls` → 200 ✓
- [x] `GET /api/ai/budget` → 200 ✓

### Endpoints Tauri (vérification manuelle requise)
- [ ] `ai_list_providers` → liste les providers disponibles
- [ ] `ai_start_session` → démarre une session
- [ ] `ai_send_message` → envoie un message, réponse streamée
- [ ] `ai_interrupt` → interrompt la génération
- [ ] `ai_stop_session` → arrête proprement
- [ ] `ai_list_past_sessions` → liste les sessions passées
- [ ] `ai_start_remote_session` → URL relay générée, countdown affiché
- [ ] `ai_stop_remote_session` → session stoppée proprement

### IA
- [ ] **Chat session** : message envoyé → réponse streamée token par token
- [ ] **Permission outil** : bouton Allow/Deny visible, réponse correcte
- [ ] **Session mobile** : RemoteControlModal → URL valide générée
- [ ] **Agent picker** : choisir un agent pour la session → appliqué
- [ ] Sessions passées : liste et lecture fonctionnelles

### UI
- [ ] Sidebar : sections Skills, Hooks, Prompts, Terminal s'ouvrent
- [ ] Création de nouveau fichier vault → input dismiss au clic extérieur
- [ ] Création d'agent → input dismiss au clic extérieur
- [ ] Liste des agents vide → message "Aucun agent"
- [ ] Animation cartes sessions (cubic-bezier spring)

### Edge cases
- [x] `sendMessage` invoke échoue → spinner se débloque + message ⚠️ dans le feed ✓
- [x] `respondPermission` échoue → message ⚠️ dans le feed, UI reste propre ✓
- [x] `interruptSession` échoue → non-fatal, log seulement ✓
- [ ] LLM non configuré → providers vides → message explicatif (à vérifier)
- [ ] Session interrompue → état "terminated" correct

### Corrections apportées
- ✅ `aiSessionStore.sendMessage` : try-catch → reset `isStreaming` + message `type:"error"` dans feed (était : spinner bloqué à vie)
- ✅ `aiSessionStore.respondPermission` : try-catch → message `type:"error"` dans feed
- ✅ `aiSessionStore.interruptSession` : try-catch non-fatal

### Post-v1 (noté, non bloquant)
- ⚪ Strings hardcodées FR dans store/composants IDE (app FR par défaut — acceptable v1)
- ⚪ Pas de banner "aucun provider" explicite quand liste vide
- ⚪ Timeout "connecting >30s" non géré

---

## 📝 Choc Notes (Vault)

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only notes` → ⚠️ 1/1 (409 vault non configuré)

### Endpoints (API REST — utilisés par l'agent IA, pas par le desktop)
- [x] `GET /api/vault/notes` → 409 ⚠️ "Vault not configured" (normal sans vault_path configuré)
- [x] `POST /api/vault/notes` → route présente (409 si vault non configuré)
- [x] `PUT /api/vault/notes/raw` → route présente
- [x] `DELETE /api/vault/notes` → route présente

> **Note** : le desktop utilise exclusivement des commandes Tauri (`notes_read`, `notes_save`, etc.) — les routes REST sont réservées à l'agent IA.

### UI (vérification manuelle requise)
- [ ] Éditeur Markdown s'ouvre
- [x] Sauvegarde : Ctrl+S + bouton Save + auto-save lors du changement de fichier (indicateur `*` si non sauvegardé) ✓
- [ ] Sidebar Vault : arborescence des dossiers visible
- [x] Création de note → input dismiss au clic extérieur — ajouté `onBlur` dans `InlineInputRow` et `InlineRenameInput` ✓
- [x] Renommage de note — `renameFile()` avec préservation d'extension + refresh tree ✓

### Edge cases
- [x] Note vide → pas de crash (éditeur affiche contenu vide, Excalidraw injecte JSON minimal) ✓
- [x] Nom de fichier avec espaces/accents → Rust PathBuf gère nativement ✓

### Corrections apportées
- ✅ `NotesSidebarContent.tsx` : `onBlur={() => requestAnimationFrame(cancelInline)}` sur `InlineInputRow` et `InlineRenameInput`
- ✅ `tools/verify-v1/index.ts` : 409 traité comme ⚠️ avec message "ressource non configurée"

---

## ⚡ Flux

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only flux` → ✓ 3/3

### Endpoints
- [x] `GET /api/flux` → 200 ✓
- [x] `GET /api/flux/counts` → 200 ✓
- [x] `POST /api/flux/suggest` → 200 ✓ (réponse instantanée sans LLM configuré = liste vide)
- [x] `POST /api/flux` → décision enregistrée via `moveItem()` dans store ✓

### IA
- [ ] **Suggestion de catégorie** : cliquer "IA Tri" → suggestions affichées
- [x] Indicateur IA pendant traitement — bouton "..." + disabled ✓
- [x] Erreur suggestion → message ⚠️ visible dans sidebar ✓ (ajouté `suggestError` signal)

### UI
- [ ] Kanban / liste : navigation fluide (vue kanban, swipe, timeline)
- [ ] Décisions (keep, skip, archive) enregistrées visuellement
- [x] Filtres par type fonctionnent — `filteredKanbanColumns` memo client-side ✓ (était non branché)
- [ ] Compteurs mis à jour après action (optimistic updates partiels — acceptable v1)

### Edge cases
- [x] Flux vide → VirtualKanbanColumn affiche "Vide" ✓
- [ ] Article sans image → pas de champ image dans le modèle (hors scope v1)

### Corrections apportées
- ✅ `fluxStore.ts` : `filteredKanbanColumns` memo (client-side filter par `activeEntityType`)
- ✅ `fluxStore.ts` : `suggestError` signal + set dans catch de `fetchSuggestions`
- ✅ `FluxView.tsx` : `getKanbanColumn` utilise `filteredKanbanColumns()` au lieu de `kanbanColumns()`
- ✅ `FluxSidebarContent.tsx` : affiche `suggestError()` sous le bouton "IA Tri"

---

## 📧 Email

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only email` → ✓ 3/3

### Endpoints
- [x] `GET /api/emails` → 200 ✓
- [x] `GET /api/email-accounts` → 200 ✓
- [x] `GET /api/emails/unread-count` → 200 ✓
- [x] `POST /api/email-accounts/test-connection` → via store `testConnection()` ✓

### UI
- [x] Liste emails chargée avec pagination — `fetchEmails()` + `loadMoreEmails()` (PAGE_SIZE=200, hasMore) ✓
- [x] Aperçu email fonctionnel — EmailDetail avec indicateurs sécurité + fallback texte ✓
- [x] Compte email configurable dans paramètres — presets Gmail/Outlook/Yahoo/etc. + test connexion ✓
- [x] Sync manuelle déclenchable — boutons Sync / Sync All avec état `isSyncing` ✓

### Edge cases
- [x] Aucun compte configuré → "Aucun compte email configuré" + bouton "Configurer →" ✓
- [x] Email HTML complexe → iframe sandbox="allow-same-origin" + srcdoc, HTML bloqué par défaut sur emails high/critical ✓ (pas de XSS)

---

## 🖥 VPS / Infra

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only vps` → ✓ 3/3

### Endpoints
- [x] `GET /api/vps/health` → 200 ✓
- [x] `GET /api/infra/servers` → 200 ✓
- [x] `GET /api/infra/config/status` → 200 ✓

### UI (vérification manuelle requise)
- [ ] Liste des serveurs visible (InfraSettings)
- [x] Statut de santé (vert/rouge) — `isConnected()` → dot rouge/vert + label "Connecté/Déconnecté" ✓
- [ ] Logs VPS accessibles — viewer SSE avec filtre niveau (ALL/ERROR/WARNING/INFO/DEBUG) + auto-scroll ✓

### Edge cases
- [x] Aucun serveur configuré → "No servers configured." dans InfraSettings + services vide "No services" ✓
- [x] Serveur inaccessible → `health()` = null + "Déconnecté" affiché, reconnect auto toutes 5s, pas de freeze ✓

### Post-v1
- ⚪ InfraSettings : dot de statut hardcodé vert (pas de health check réel par serveur dans settings)
- ⚪ Pas d'indicateur "Reconnexion en cours..." visible

---

## 📡 RSS

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only rss` → ✓ 3/3

### Endpoints
- [x] `GET /api/rss-feeds` → 200 ✓
- [x] `GET /api/rss-articles` → 200 ✓
- [x] `GET /api/rss-articles/unread-count` → 200 ✓
- [x] `POST /api/rss-feeds/sync-all` → `syncAll()` dans rssStore ✓

### UI (vérification manuelle requise)
- [ ] Feeds listés dans sidebar
- [ ] Articles chargés par feed
- [x] Marquer comme lu — `selectArticle()` auto-mark + `markAllRead()` ✓
- [x] Actualisation manuelle — bouton sync + `isLoading` state ✓

### Edge cases
- [x] Feed invalide → `addFeed()` try-catch, pas de crash, autres feeds OK ✓
- [x] Aucun article → "Aucun article" / "Aucun flux" selon état ✓

### Post-v1
- ⚪ Erreurs de sync uniquement dans console (pas de toast utilisateur)

---

## 🔄 CI/CD (GitHub)

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only cicd` → ✓ 3/3

### Endpoints
- [x] `GET /api/github/prs` → 200 ✓
- [x] `GET /api/github/runs` → 200 ✓
- [x] `GET /api/connector-configs` → 200 ✓

### UI (vérification manuelle requise)
- [ ] PRs listées avec statut (draft/open + review status)
- [ ] Workflow runs avec statut (success/failure/running)
- [x] Lien "Ouvrir dans GitHub" — `openUrl()` sur PR.url / run.url ✓

### Edge cases
- [x] Token expiré → 401 swallowed silently, pas de crash ✓ (acceptable v1)
- [x] Aucun repo configuré → "Non configuré" + bouton "Lier au repo" ✓

### Post-v1
- ⚪ Token expiré : pas de prompt re-auth explicite (erreur silencieuse)

---

## 🔧 Tools (Tâches, Snippets, Changelog)

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only tools` → ✓ 4/4 + ⚠️ 2/6 (LLM/git non configurés)

### Endpoints
- [x] `GET /api/tasks` → 200 ✓
- [x] `GET /api/snippets` → 200 ✓
- [x] `POST /api/llm/generate-code` → 503 ⚠️ LLM non configuré (route OK)
- [x] `POST /api/changelog/generate` → 503 ⚠️ git non configuré (était 500 — corrigé)

### IA (vérification manuelle requise)
- [ ] **Génération de code** : sélectionner une tâche → "Générer du code" → snippet créé dans Notes
- [ ] **Changelog** : choisir une date → générer → markdown affiché
- [x] Indicateurs IA — `trackAiActivity()` dans taskStore.generateCode() + changelogService ✓

### UI (vérification manuelle requise)
- [ ] TaskJar : liste, filtres, détail, création manuelle
- [ ] Snippets : création, copie, suppression
- [ ] Timer : démarrage/arrêt fonctionne

### Edge cases
- [x] Tâche sans description → `description?: undefined` accepté, `generateCode()` n'explose pas ✓
- [x] Changelog sans commits → service retourne `{ commits: [], changelog: "Aucun commit trouve." }` ✓

### Corrections apportées
- ✅ `changelog.routes.ts` : catch "No git repos configured" → 503 (était 500)

---

## 🔒 Mots de passe (Tauri-only)

> Aucun endpoint HTTP — entièrement piloté par Tauri via KDBX.
> Vérification 100% manuelle.

### UI (vérification manuelle requise)
- [ ] Ouverture vault KDBX fonctionne
- [ ] Création / modification / suppression d'entrée
- [ ] Copie dans presse-papier (auto-clear après 30s)
- [ ] Verrouillage et déverrouillage

### Edge cases
- [ ] Mauvais mot de passe → erreur propre
- [ ] Fichier KDBX absent → onboarding création

---

## ⚙️ Paramètres

> **Script** : `bun tools/verify-v1/index.ts --base http://localhost:47300 --only settings` → ✓ 2/2

### Endpoints
- [x] `GET /api/user-preferences` → 200 ✓
- [x] `PUT /api/user-preferences` → route présente, sauvegarde via store ✓
- [x] `GET /api/llm/config` → 200 ✓
- [x] `POST /api/llm/test` → 200 ✓ (`{ success: false, reason: "not_configured" }` si non configuré)

### UI (vérification manuelle requise)
- [x] Changement de langue FR ↔ EN — `localStorage("magick-cookie-locale")` + reload ✓
- [ ] Config LLM (provider, modèle, clé API) sauvegardée
- [ ] Test connexion LLM → résultat affiché
- [ ] Préférences persistées après redémarrage app

### Edge cases
- [ ] Clé API LLM invalide → message d'erreur propre (pas de crash)
- [x] Provider offline → `POST /llm/test` retourne `{ success: false }` sans crash ✓

---

## 🌍 i18n

- [ ] Toutes les vues en FR (par défaut) : aucune string anglaise visible
- [ ] Switch vers EN : toutes les strings traduites
- [ ] Aucune clé manquante (pas de `undefined` ou `[missing: ...]` visible)
- [ ] Sections : ATELIER / ESPACE DE TRAVAIL (FR), WORKBENCH / WORKSPACE (EN)
- [ ] "Agents" (pas "Workflows") dans sidebar et pickers

---

## 🔁 Régression globale

- [ ] `rtk tsc --noEmit` → 0 erreur nouvelle
- [ ] Lancement à froid (première ouverture) → pas de crash console
- [ ] Navigation entre tous les onglets → 0 erreur console
- [ ] Retour hors-ligne → toasts d'erreur propres, pas de crash
- [ ] Mémoire stable sur 10 min (pas de fuite évidente)

---

## ✅ Signature de validation

| Vérificateur | Date | Notes |
|---|---|---|
| | | |

> Une fois toutes les cases cochées, la v1 est prête pour publication.
