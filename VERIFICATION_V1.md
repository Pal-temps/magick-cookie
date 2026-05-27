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

### Endpoints
- [ ] `GET /api/vault/notes` → 200 (liste)
- [ ] `POST /api/vault/notes` → création OK
- [ ] `PUT /api/vault/notes/raw` → mise à jour OK
- [ ] `DELETE /api/vault/notes` → suppression OK

### UI
- [ ] Éditeur Markdown s'ouvre
- [ ] Sauvegarde automatique (pas de perte de données)
- [ ] Sidebar Vault : arborescence des dossiers visible
- [ ] Création de note → input dismiss au clic extérieur ✓
- [ ] Renommage de note fonctionne

### Edge cases
- [ ] Note vide → pas de crash à l'ouverture
- [ ] Nom de fichier avec espaces/accents → encodé correctement

---

## ⚡ Flux

### Endpoints
- [ ] `GET /api/flux` → 200
- [ ] `GET /api/flux/counts` → 200
- [ ] `POST /api/flux/suggest` → 200 (suggestions IA)
- [ ] `POST /api/flux` → décision enregistrée

### IA
- [ ] **Suggestion de catégorie** : article sélectionné → suggestion IA affichée
- [ ] Indicateur IA pendant traitement

### UI
- [ ] Kanban / liste : navigation fluide
- [ ] Décisions (keep, skip, archive) enregistrées visuellement
- [ ] Filtres par type fonctionnent
- [ ] Compteurs mis à jour après action

### Edge cases
- [ ] Flux vide → état vide propre
- [ ] Article sans image → placeholder correct

---

## 📧 Email

### Endpoints
- [ ] `GET /api/emails` → 200
- [ ] `GET /api/email-accounts` → 200
- [ ] `GET /api/emails/unread-count` → 200
- [ ] `POST /api/email-accounts/test-connection` → 200

### UI
- [ ] Liste emails chargée avec pagination
- [ ] Aperçu email fonctionnel
- [ ] Compte email configurable dans paramètres
- [ ] Sync manuelle déclenchable

### Edge cases
- [ ] Aucun compte configuré → message d'onboarding
- [ ] Email HTML complexe → rendu correct (pas de XSS)

---

## 🖥 VPS / Infra

### Endpoints
- [ ] `GET /api/vps/health` → 200
- [ ] `GET /api/infra/servers` → 200
- [ ] `GET /api/infra/config/status` → 200

### UI
- [ ] Liste des serveurs visible
- [ ] Statut de santé (vert/rouge) affiché
- [ ] Logs VPS accessibles

### Edge cases
- [ ] Aucun serveur configuré → message vide propre
- [ ] Serveur inaccessible → erreur affichée, pas de freeze

---

## 📡 RSS

### Endpoints
- [ ] `GET /api/rss-feeds` → 200
- [ ] `GET /api/rss-articles` → 200
- [ ] `GET /api/rss-articles/unread-count` → 200
- [ ] `POST /api/rss-feeds/sync-all` → déclenche sync

### UI
- [ ] Feeds listés dans sidebar
- [ ] Articles chargés par feed
- [ ] Marquer comme lu fonctionne
- [ ] Actualisation manuelle déclenchable

### Edge cases
- [ ] Feed invalide (URL morte) → erreur propre, autres feeds OK
- [ ] Aucun article → état vide propre

---

## 🔄 CI/CD (GitHub)

### Endpoints
- [ ] `GET /api/github/prs` → 200
- [ ] `GET /api/github/runs` → 200
- [ ] `GET /api/connector-configs` → 200

### UI
- [ ] PRs listées avec statut
- [ ] Workflow runs avec statut (pass/fail)
- [ ] Lien "Ouvrir dans GitHub" fonctionne

### Edge cases
- [ ] Token GitHub expiré → message d'erreur propre
- [ ] Aucun repo configuré → onboarding visible

---

## 🔧 Tools (Tâches, Snippets, Changelog)

### Endpoints
- [ ] `GET /api/tasks` → 200
- [ ] `GET /api/snippets` → 200
- [ ] `POST /api/llm/generate-code` → 200 (avec body minimal)
- [ ] `POST /api/changelog/generate` → 200 (avec `since` date)

### IA
- [ ] **Génération de code** : sélectionner une tâche → cliquer "Générer du code" → snippet créé dans Notes
- [ ] **Changelog** : choisir une date → générer → markdown affiché
- [ ] Indicateurs IA visibles pendant traitement

### UI
- [ ] TaskJar : liste, filtres, détail, création manuelle
- [ ] Snippets : création, copie, suppression
- [ ] Timer : démarrage/arrêt fonctionne

### Edge cases
- [ ] Tâche sans description → génération ne plante pas
- [ ] Changelog sans commits → message "aucun commit"

---

## 🔒 Mots de passe (Tauri-only)

> Aucun endpoint HTTP — entièrement piloté par Tauri via KDBX.

### UI
- [ ] Ouverture vault KDBX fonctionne
- [ ] Création / modification / suppression d'entrée
- [ ] Copie dans presse-papier (auto-clear après 30s)
- [ ] Verrouillage et déverrouillage

### Edge cases
- [ ] Mauvais mot de passe → erreur propre
- [ ] Fichier KDBX absent → onboarding création

---

## ⚙️ Paramètres

### Endpoints
- [ ] `GET /api/user-preferences` → 200
- [ ] `PUT /api/user-preferences` → sauvegarde OK
- [ ] `GET /api/llm/config` → 200
- [ ] `POST /api/llm/test` → 200 (test connexion LLM)

### UI
- [ ] Changement de langue FR ↔ EN fonctionne
- [ ] Config LLM (provider, modèle, clé API) sauvegardée
- [ ] Test connexion LLM → résultat affiché
- [ ] Préférences persistées après redémarrage app

### Edge cases
- [ ] Clé API LLM invalide → message d'erreur propre (pas de crash)
- [ ] Provider offline → timeout géré

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
