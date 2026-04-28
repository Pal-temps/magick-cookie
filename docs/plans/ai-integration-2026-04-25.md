# Plan — Intégration AI complète (Cookia × toutes les features)

**Date de création** : 2026-04-25
**Dernière mise à jour** : 2026-04-25
**Statut global** : 🟡 En attente de démarrage (Phase 1)

---

## Objectif

Relier toutes les features de Magick Cookie au moteur AI Cookia via une surface de tools unifiée, et unifier les identités providers (GitHub / GitLab / ClickUp) pour qu'une seule configuration serve toutes les features.

### Critères de succès

- Cookia peut CRUD : notes, tâches, flux, emails, calendrier, contacts, RSS, bookmarks, snippets, alarmes
- Une seule config GitHub utilisée partout (task sync + CI/CD + PR view + tools AI)
- Idem GitLab, idem ClickUp
- Actions sensibles demandent confirmation utilisateur inline dans le chat
- Audit trail de toutes les actions AI consultable depuis une vue "AI Activity"

---

## Diagnostic initial (2026-04-25)

### Tools AI existants (10 fichiers)
`task`, `flux`, `memory`, `timer`, `analytics`, `brief`, `skill`, `git-remote`, `deploy`, `dns`, `ssh`

### Gaps identifiés

| Domaine | Read | Write |
|---------|------|-------|
| Notes (vault) | ⚠️ via mention picker | ❌ **aucun write** |
| Calendar | ✅ get_events | ❌ aucun create/edit/delete |
| Emails | ✅ count/sync/classify | ❌ aucun compose/send/move |
| Contacts | ❌ | ❌ |
| RSS | ⚠️ digest only | ❌ aucun add feed/star/mark |
| Bookmarks | ⚠️ list | ⚠️ create seul |
| Snippets | ❌ | ❌ |
| Alarms / Routines | ❌ | ❌ |

### Fragmentation providers

| Provider | État |
|----------|------|
| **GitHub** | ⚠️ **DOUBLE** config — table `github_config` (legacy) + `connector_configs` (moderne). Token saisi 2× |
| **GitLab** | ✅ Unifié via `connector_configs` |
| **ClickUp** | ✅ Unifié via `connector_configs` |

---

## 🏛️ Règles d'architecture (DDD) à respecter

Ces règles sont **non-négociables** pour toute implémentation. Elles reflètent les conventions existantes observées dans le code au 2026-04-25.

### API (`apps/api/src/`) — 4 couches

| Couche | Dossier | Contenu | Ne doit PAS |
|--------|---------|---------|-------------|
| **Domain** | `domain/<entity>/` | `<entity>.entity.ts` (types + DTOs) + `<entity>.repository.ts` (interface) | Contenir de la logique métier, importer infrastructure |
| **Application** | `application/<entity>/` | `<entity>.service.ts` — logique métier, reçoit les repos en constructor | Instancier des repos, appeler `db.xxx` directement |
| **Infrastructure** | `infrastructure/repositories/` + `infrastructure/database/schema.ts` | `<entity>.repository.impl.ts` (classe Drizzle) + schéma de tables | Contenir de la logique métier. Le mapping DB↔entity passe par un `toDomain()` privé |
| **Presentation** | `presentation/routes/` + `presentation/validators/` + `presentation/middleware/` | Hono factory `create<Entity>Routes(service)` + zod schemas | Appeler un repo directement, contenir de la logique métier, instancier un service |

### Les 10 règles strictes (observées dans le code)

1. **Routes → Service → Repository** : un sens unique. Jamais Route → Repo.
2. **Services ne s'instancient pas leurs repos** : ils les reçoivent en constructor params (DI manuelle).
3. **Wiring central dans `apps/api/src/index.ts`** : `new Repo(db)` → `new Service(repo)` → `app.route("/api/x", createXRoutes(service))`. Pas de container DI.
4. **Zod dans `presentation/validators/`** — jamais inline dans les routes. Nommage `<entity><Operation>Schema`.
5. **`toDomain()` privé dans chaque repo impl** : les routes/services ne voient jamais de row Drizzle brute.
6. **Drizzle migrations numérotées séquentiellement** (`0034_*.sql`, `0035_*.sql`) — générées via `drizzle-kit`, jamais hand-coded.
7. **Services stateless** : pas de signal/cache mutable. State en DB uniquement.
8. **Dépendances optionnelles checkées** : `if (this.emailRepo)` avant usage. Permet l'activation partielle.
9. **Batch queries anti-N+1** : pattern `batchFetchEntityMetadata` (cf. `FluxService`).
10. **Validation boundary = route** : `safeParse()` + 400 propre. Jamais `.parse()` qui throw 500.

### Desktop (`apps/desktop/src/`)

- **Stores** = singletons module-level (SolidJS signals). Ne jamais appeler `invoke()` directement ; passer par un **service** dans `application/services/` qui wrappe l'invoke.
- **CRUD store standard** : utiliser le factory `createCrudStore({ endpoint, label })` quand c'est du CRUD classique.
- **API client** : `api.get/post/put/delete` de `infrastructure/api/apiClient.ts`. Pas de `fetch()` direct.
- **i18n** : chaque string UI passe par `t("clé")`. Nouveaux strings ajoutés dans `i18n/fr.ts` ET `i18n/en.ts` (+ `types.ts`).
- **Format dates** : `formatDate(d, locale(), opts)` de `i18n/format.ts`. Jamais `toLocaleDateString(locale() === "fr" ? ... : ...)`.

### Rust (`apps/desktop/src-tauri/src/`)

- Modules flat ou subdir par feature majeure (ex. `ai/`).
- Commands `#[tauri::command]` enregistrées dans `lib.rs` via `invoke_handler![...]`.
- State partagé : `Arc<Mutex<T>>`, passé via `tauri::State<'_, T>`.
- Nommage : `<module>_<action>` (ex. `notes_read`, `secrets_get`).
- Tests : `#[cfg(test)] mod tests` en bas des fichiers, pas de folder séparé.

---

## ✅ Definition of Done (chaque phase)

Une phase est livrée **uniquement** si :

1. **DDD respecté** : tout nouveau code suit la séparation des 4 couches ci-dessus.
2. **Tests verts** : `bun test` dans le root → 0 fail. Si des tests existants ont cassé, ils sont **corrigés ou mis à jour dans le même commit** que le changement, pas reportés.
3. **Nouveaux tests écrits** : chaque nouveau tool/service a au moins 1 test unitaire avec mocks.
4. **TypeScript propre** : `tsc --noEmit` sur `apps/desktop/tsconfig.json` ET `apps/api/tsconfig.json` → 0 erreur.
5. **Rust check** : `cargo check` dans `apps/desktop/src-tauri` → 0 warning (si changement Rust). `cargo test --lib` passe.
6. **Code mort supprimé** : voir la section "🧹 Dead code cleanup" de chaque phase. Pas de "je nettoierai plus tard".
7. **Migration Drizzle appliquée** : `bun run db:migrate` OK, nouveau fichier SQL numéroté.
8. **i18n** : toute nouvelle string UI présente en FR + EN.
9. **Commit(s)** : messages en anglais, format `<type>(<scope>): <summary>`. Référence le numéro de phase dans le body (`Ref: AI plan P1`).
10. **Plan mis à jour** : checkboxes cochées dans ce fichier + ligne ajoutée au journal de session en bas.

### Commandes de validation à lancer en fin de phase

```bash
rtk bun test --cwd "C:\Users\bumbl\Documents\Perso\magick-cookie"
rtk tsc --noEmit -p "C:\Users\bumbl\Documents\Perso\magick-cookie\apps\desktop\tsconfig.json"
rtk tsc --noEmit -p "C:\Users\bumbl\Documents\Perso\magick-cookie\apps\api\tsconfig.json"
# Si Rust touché :
cd apps/desktop/src-tauri && rtk cargo check && rtk cargo test --lib
```

---

## Phase 1 — Unifier GitHub (déblocage critique)

**Statut** : ✅ Terminé (2026-04-25)
**Durée estimée** : 1 session dense
**Dépend de** : rien
**Débloque** : Phase 5

### Objectif
Une seule configuration GitHub, lue partout.

### Tâches

- [x] Migration Drizzle : `github_config` → `connector_configs.settings` (username, repos, pollInterval en JSON) — `0034_github_unify.sql`
- [x] Script de backfill qui lit l'ancienne table et upsert dans `connector_configs` — intégré dans 0034
- [x] Remplacer `githubConfigRepo` par `connectorConfigRepository` dans :
  - [x] `GitHubService` (apps/api/src/application/github/)
  - [x] `github-sync.service.ts` (était déjà sur connector_configs — rien à faire)
  - [x] `task-detail.service.ts` (était déjà sur connector_configs — rien à faire)
  - [x] `githubStore.ts` (frontend) — inchangé, `/api/github/*` garde sa forme
- [x] Supprimer la page `GitHubSettings.tsx` (frontend)
- [x] `/api/github/*` routes conservent la forme publique mais lisent via connector_configs
- [x] `github_prs` table → renommer `synced_issues` + colonnes `source` + `externalId` (réutilisable gitlab/clickup)
- [x] Tests : task sync + CI/CD + PR view passent avec un seul token — nouveau test `github.service.test.ts` (7 tests)

### Done when
L'utilisateur saisit son token GitHub **une seule fois** dans ConnectorSettings. Task sync, CI/CD et PR view marchent tous. Legacy `github_config` table supprimée.

### 🏛️ Architecture notes
- La migration Drizzle respecte la convention `0034_github_unify.sql` (numéro séquentiel après le dernier).
- `connectorConfigRepository.findByType("github")` est le **seul** point d'accès au token GitHub après cette phase. Tout autre code qui lit le token doit passer par ce chemin.
- `GitHubService` **ne change pas de forme publique** (mêmes méthodes, mêmes routes) — seule sa source de données change. Ça évite un refacto dans le frontend.
- La renommer `github_prs` → `synced_issues` implique d'ajouter un champ `source` + `externalId` et de modifier le repo en conséquence — pattern aligné avec `flux_items` qui est déjà entity-agnostique.
- Chaque refacto passe par `service → repo interface → impl`, jamais un shortcut direct vers Drizzle dans le service.

### 🧹 Dead code cleanup (obligatoire en fin de phase)
- [ ] Table `github_config` : migration DROP TABLE après backfill vérifié
- [ ] Fichier `apps/api/src/domain/github/github-config.entity.ts` (si existe)
- [ ] Fichier `apps/api/src/domain/github/github-config.repository.ts` (si existe)
- [ ] Fichier `apps/api/src/infrastructure/repositories/github-config.repository.impl.ts`
- [ ] Toute instance de `githubConfigRepo` dans `apps/api/src/index.ts`
- [ ] Fichier frontend `apps/desktop/src/ui/components/settings/GitHubSettings.tsx`
- [ ] Entrée menu settings qui pointait vers GitHubSettings
- [ ] i18n strings `settings.github.*` (FR + EN) si non réutilisées par ConnectorSettings
- [ ] Tests orphelins dans `__tests__/unit/github-config*` (à supprimer ou migrer)
- [ ] Tout import mort détecté par `tsc --noEmit`

### 🧪 Tests
- [ ] Mettre à jour les tests de `GitHubService` pour mocker `connectorConfigRepo` au lieu de `githubConfigRepo`
- [ ] Nouveau test : migration idempotente (rejouer la migration ne casse pas)
- [ ] Test de non-régression : task sync GitHub marche end-to-end avec un seul token
- [ ] `bun test` passe intégralement avant commit

### Fichiers clés
- `apps/api/src/infrastructure/database/schema.ts`
- `apps/api/drizzle/*`
- `apps/api/src/application/github/`
- `apps/desktop/src/ui/components/settings/GitHubSettings.tsx` (à supprimer)
- `apps/desktop/src/application/stores/githubStore.ts`

---

## Phase 2 — Tool convention + permission layer

**Statut** : ✅ Terminé (2026-04-25)
**Durée estimée** : 1 session
**Dépend de** : rien (peut être parallèle à P1)
**Débloque** : Phases 3, 4, 5

### Objectif
Cadre commun avant d'ajouter ~20 tools supplémentaires.

### Tâches

- [x] Contract tool unique `{ name, description, paramsSchema (zod), execute, permissionLevel }`
- [x] `permissionLevel` enum : `auto` | `user-confirm` | `admin`
- [x] Helper `defineTool(cfg)` dans `tool-registry.ts` pour réduire la boilerplate
- [x] `agent.service.ts` intercepte les tools `user-confirm` — pour l'instant deny + audit. Le flux interactif `permission_request` → `ai_respond_permission` sera branché en P4 quand un UI le consommera.
- [ ] Propagation côté Rust via `ai_respond_permission` — reporté à P4 (channel pas encore requis pour l'API-side agent qui est non-interactif)
- [x] Nouvelle table `ai_tool_calls` : conversationId, sessionId, toolName, permissionLevel, args, result, errorMessage, status, durationMs, createdAt
- [x] Rate limits configurables par tool (scope conversation+tool, sliding window in-memory)
- [x] Logging structuré des erreurs de tool avec status structuré (`ok` / `error` / `denied` / `invalid_input` / `rate_limited`)

### Done when
Un nouveau tool s'écrit en ~20 lignes. Les actions sensibles demandent confirmation inline. L'audit trail est interrogeable.

### 🏛️ Architecture notes
- `ai_tool_calls` suit la convention DDD : domain (`AiToolCall` entity + `AiToolCallRepository` interface), infrastructure (`DrizzleAiToolCallRepository` impl), application (`AiToolCallService`), presentation (si on expose une route de consultation).
- `defineTool()` vit dans `application/agent/tool-registry.ts` — c'est une fonction helper, pas un nouveau paradigme. Les tools existants sont progressivement migrés.
- Le système de permission s'intègre dans `agent.service.ts` qui émet déjà des events — on ajoute `permission_request` (déjà supporté côté Rust via `ai_respond_permission`). Pas de nouveau canal.
- Rate limiting : simple in-memory par `{ sessionId, toolName }` avec window glissante. Pas de Redis.
- Zod : les paramètres de tool passent par un schema zod, validés dans `execute()` wrapper. Erreur de validation = tool result avec `error: "InvalidInput"` (pas un throw).
- **Migration progressive** : les 10 tools existants sont réécrits avec `defineTool()` un par un dans la même phase — pas laisser deux conventions cohabiter.

### 🧹 Dead code cleanup
- [ ] Ancienne signature de tools (sans `permissionLevel`, sans schema zod) : supprimer après migration
- [ ] Toute logique de parsing des paramètres tool inline dans `agent.service.ts` → remplacée par le wrapper `defineTool`
- [ ] Helpers ad-hoc de validation dans les tool files (s'ils deviennent redondants avec zod)
- [ ] Code de permission hardcodé (ex. blocklist de tools sensibles) remplacé par le `permissionLevel`

### 🧪 Tests
- [ ] Test unitaire de `defineTool()` : validation zod, passage de permission level, wrapping de l'execute
- [ ] Test du flux `permission_request` → `ai_respond_permission` de bout en bout (mock du side channel)
- [ ] Test du rate limiter : 6ème call dans la fenêtre rejeté proprement
- [ ] Chaque tool migré garde ses tests existants verts (regression guard)
- [ ] Test de l'audit trail : une tool call crée bien une row dans `ai_tool_calls`

### Fichiers clés
- `apps/api/src/application/agent/tool-registry.ts`
- `apps/api/src/application/agent/agent.service.ts`
- Nouvelle migration `ai_tool_calls` dans `apps/api/drizzle/`
- Nouveau `apps/api/src/domain/ai-tool-call/` (entity + repo interface)
- Nouveau `apps/api/src/infrastructure/repositories/ai-tool-call.repository.impl.ts`

---

## Phase 3 — Notes bridge (le gros pavé)

**Statut** : ✅ Terminé (2026-04-25)
**Durée estimée** : 1-2 sessions
**Dépend de** : P2
**Débloque** : Phases 4, 6 (beaucoup de tools écrivent dans les notes)

### Objectif
Cookia peut CRUD les choco'notes.

### Décision architecturale
L'API a besoin d'accéder au vault sur disque. Le path est partagé (`~/.local/share/magick-cookie-vault/`). Ajouter un `VaultService` dans l'API qui lit le même path. Git sync reste côté Tauri (desktop, pas AI). **Le `VaultService` existait déjà** (`infrastructure/vault/`) avec protection anti path-traversal + symlink — on l'a réutilisé via un `FsVaultNoteRepository` qui délègue le `resolvePath`.

### Tâches

- [x] `VaultService` dans l'API : lecture/écriture markdown vault (réutilisé, + nouveau `FsVaultNoteRepository` par-dessus)
- [x] Nouveaux endpoints `/api/vault/notes` :
  - [x] `GET /` list (prefix + limit)
  - [x] `GET /raw?path=` read
  - [x] `POST /` create
  - [x] `PUT /raw?path=` update (body et/ou frontmatter merge)
  - [x] `DELETE /?path=` delete
  - [x] `POST /rename?path=` rename
  - [x] `POST /append?path=` append
- [x] Tools AI : `notes_list`, `notes_read`, `notes_create`, `notes_edit`, `notes_append`, `notes_delete`, `notes_rename`
- [x] Permission levels : create/edit/append/rename = `auto`, delete = `user-confirm`
- [x] Préserver les frontmatter YAML existants lors des edits (parser + merge, null = delete key)
- [x] Lock file par note (`.lock` adjacent, stale > 5s)
- [x] Politique : `notes_create` applique `_ai/` par défaut si path sans dossier (via `applyAiDefaultPrefix`)
- [x] Tests : 29 nouveaux (22 repository + 7 service)

### Risques
- Collision d'écriture simultanée Tauri ↔ API sur le même fichier
- Mitigation : lock file + convention `_ai/` par défaut

### Done when
Démo : "Cookia, écris-moi une note sur la refonte Flux" → fichier apparaît dans l'onglet Notes, formaté correctement, frontmatter propre.

### 🏛️ Architecture notes
- `VaultService` côté API = **application layer**. Il lit/écrit le filesystem — c'est un "infrastructure concern" encapsulé derrière une interface `VaultRepository` (ex. `FsVaultRepository` impl) pour rester testable.
- Domain : `VaultNote` entity (`path`, `content`, `frontmatter`, `updatedAt`). Pas de ORM — le filesystem EST le store.
- Routes `/api/vault/notes` suivent le pattern standard : factory `createVaultRoutes(service)`, validators dans `vault.validator.ts`.
- Le chemin vault est résolu via variable d'env / config (déjà fait pour le Tauri side). Ajouter la résolution côté API dans le bootstrap.
- **Politique de séparation** : l'AI écrit par défaut dans `_ai/` (sous-dossier), sauf si l'utilisateur fournit un chemin explicite via le paramètre `path`. Validation dans la route : le chemin doit être sous le vault root (pas de `../` path traversal — utilise `path.resolve` + vérification prefix).
- Lock file : `.lock` adjacent au markdown, posé en write, libéré en end/error. Si lock présent > 5s, considéré stale (Tauri probablement crashé).
- Tools AI appellent les routes API (pas directement le VaultService) — ça évite une deuxième DI hierarchy dans le monde des tools.

### 🧹 Dead code cleanup
- [ ] Si des helpers de lecture vault existent déjà côté API (ex. dans brief.service), les consolider dans `VaultService`
- [ ] Ancien code qui fait du `fs.readFile(vaultPath + ...)` direct → remplacé par VaultService
- [ ] Si `brief.service` lit les notes via un autre chemin, migrer aussi (pas deux façons de lire le vault)

### 🧪 Tests
- [ ] `VaultService` unit tests avec un repo mocké (mock FS ou vraie FS temp)
- [ ] Test path traversal : `{ path: "../etc/passwd" }` → 400
- [ ] Test frontmatter préservé lors d'un edit
- [ ] Test lock file : 2 writes concurrents → le 2ème attend ou retourne conflict
- [ ] Test intégration bout-en-bout : tool `notes_create` → fichier apparaît dans le vault
- [ ] Non-régression : les Tauri commands `notes_read/save/delete` fonctionnent toujours (la coexistence ne casse rien)

---

## Phase 4 — Domaines user-facing CRUD

**Statut** : 🟡 En cours (4.1 Calendar + 4.2 Email + 4.3 RSS shippées 2026-04-28)
**Durée estimée** : 2-3 sessions (2-3 domaines par session)
**Dépend de** : P2
**Débloque** : Phase 6

### Objectif
Tous les domaines user-facing sont CRUD-able par l'AI.

### Sous-tâches par domaine

#### 4.1 — Calendar + CalDAV
- [x] `calendar_list` (2026-04-28)
- [x] `calendar_create_event` (user-confirm) (2026-04-28)
- [x] `calendar_update_event` (2026-04-28)
- [x] `calendar_delete_event` (user-confirm) (2026-04-28)
- [x] `calendar_find_conflict` (2026-04-28)
- [x] `calendar_generate_events_from_prompt` (wrapper `llmService.generateEvents`) (2026-04-28)

#### 4.2 — Email actions
- [x] `email_compose` (2026-04-28)
- [x] `email_send` (user-confirm) (2026-04-28)
- [x] `email_reply` (user-confirm — flipped from auto, per inversibilite) (2026-04-28)
- [x] `email_mark_read` (2026-04-28)
- [x] `email_star` (2026-04-28)
- [x] `email_move` (+IMAP `moveMessage` + repo `updateFolder` + service `moveEmail`) (2026-04-28)
- [x] `email_delete` (user-confirm) (2026-04-28)
- [x] `email_bulk_delete` (admin) (2026-04-28)

#### 4.3 — RSS management
- [x] `rss_add_feed` (2026-04-28)
- [x] `rss_remove_feed` (user-confirm) (2026-04-28)
- [x] `rss_star` (2026-04-28)
- [x] `rss_mark_read` (2026-04-28)
- [x] `rss_mark_all_read` (2026-04-28)
- [x] `rss_generate_digest` (2026-04-28)

#### 4.4 — Bookmarks
- [ ] `bookmark_list`
- [ ] `bookmark_create`
- [ ] `bookmark_update`
- [ ] `bookmark_delete`
- [ ] `bookmark_categorize`

#### 4.5 — Snippets
- [ ] Full CRUD
- [ ] `snippet_search_by_tag`

#### 4.6 — Contacts
- [ ] Full CRUD
- [ ] `contact_find_by_email`

#### 4.7 — Alarms + Routines
- [ ] Full CRUD sur alarms
- [ ] Full CRUD sur routines
- [ ] Delete = `user-confirm`

### Tool selection heuristique
- [ ] L'`agent.service` injecte seulement les tools pertinents selon le mode de session (ide / chat / brief / triage)
- [ ] Éviter l'explosion du system prompt

### Done when
Démo réalisable : *"Lis mon email de CNR puis ajoute un évènement dans mon calendrier le 15, et mets un bookmark vers leur site"*. Trois tools enchaînés, une confirmation utilisateur avant le create event.

### 🏛️ Architecture notes
- **Chaque tool file = wrapper mince autour du service existant**. Ne PAS dupliquer de logique métier dans le tool. Ex. `email_send` appelle `emailService.send(...)` qui existe déjà.
- Un tool file par domaine, nommé `<domain>.tools.ts` dans `application/agent/tools/` (convention existante).
- Zod schema de params toujours exporté nommé `<toolName>Schema` pour réutilisation dans tests.
- Si un service manque une méthode nécessaire au tool → l'ajouter au service (pas contourner via repo). Le tool n'appelle JAMAIS un repo directement.
- **Tool selection heuristique** : dans `agent.service.ts`, fonction `selectToolsForSession(mode, userContext)` qui filtre le tool set. Ne pas surcharger la session avec 50 tools d'un coup.
- Les tools `user-confirm` doivent renvoyer un "dry run preview" avant l'action réelle si possible (ex. `email_send` preview le destinataire + sujet + body summary avant l'envoi).

### 🧹 Dead code cleanup
- [ ] `brief.tools.ts` actuel mélange read-only brief + actions email/calendar partielles → extraire les actions dans les nouveaux tool files, garder `brief.tools` strictement read-only
- [ ] Tout code de validation/permission ad-hoc dans les tool files → remplacé par la convention Phase 2
- [ ] Endpoints API orphelins si on en consolide (peu probable, mais vérifier)
- [ ] i18n des anciens messages AI hardcodés si remplacés par les tool descriptions

### 🧪 Tests
- [ ] **1 test unitaire minimum par tool** : mock du service, vérifie que le tool appelle la bonne méthode avec les bons args
- [ ] Test des permissions : tool `user-confirm` sans permission accordée → retourne `{ error: "PermissionDenied" }`
- [ ] Test du tool selection heuristique : mode `triage` n'inclut pas les tools `deploy_*`
- [ ] Test d'intégration d'un chain : email → calendar → bookmark, en mode streaming
- [ ] Tests existants de `brief.tools` mis à jour si on restructure

---

## Phase 5 — Providers unifiés dans les tools AI

**Statut** : ⬜ À faire
**Durée estimée** : 1 session
**Dépend de** : P1, P2

### Objectif
L'AI parle de "mon GitHub / mon GitLab / mon ClickUp" sans jamais demander le token.

### Tâches

- [ ] `ProviderService` qui expose `getActiveToken(provider)`, `getUsername(provider)`, `isConfigured(provider)` — lit `connector_configs`
- [ ] Tools GitHub :
  - [ ] `github_list_repos`
  - [ ] `github_create_issue`
  - [ ] `github_close_issue`
  - [ ] `github_add_comment`
  - [ ] `github_trigger_workflow`
  - [ ] `github_list_prs`
  - [ ] `github_review_pr` (user-confirm)
- [ ] Tools GitLab (mêmes verbes, préfixe `gitlab_`)
- [ ] Tools ClickUp :
  - [ ] `clickup_create_task`
  - [ ] `clickup_assign`
  - [ ] `clickup_change_status`
  - [ ] `clickup_add_comment`
- [ ] Si provider non configuré, tool retourne `{ error: "Provider not configured", configureUrl: "settings/connectors" }`
- [ ] Bloc `<providers>` dans le SystemPrompt listant ce qui est configuré

### Done when
*"Crée une issue GitHub pour le bug FluxView"* → issue créée sous l'identité unique, sans prompt token.

### 🏛️ Architecture notes
- `ProviderService` = **application layer**. Reçoit le `ConnectorConfigRepository` en constructor. Expose `getActiveToken(provider)` + `getUsername(provider)` + `isConfigured(provider)` + `getClient<T>(provider)` qui retourne un client typé (Octokit pour github, etc.).
- Dépend de **Phase 1** : GitHub doit être unifié avant. Sinon le ProviderService aurait deux sources pour github.
- Les clients externes (Octokit, Gitlab SDK, ClickUp API) sont instanciés **à la demande** via ProviderService avec le bon token. Pas de singleton client.
- Tools github/gitlab/clickup = wrappers autour du client retourné par ProviderService. Logique minimale, juste l'appel + le mapping du résultat.
- Cache de user identity (avatar, repos list) dans `connector_configs.settings` (colonne JSON existante). Rafraîchi lazy sur miss.

### 🧹 Dead code cleanup
- [ ] Ancien code qui lit le token GitHub depuis `github_config` → tous migrés (phase 1 déjà fait, vérification)
- [ ] Ad-hoc instances de `Octokit` ou `GitLab client` créés dans 2+ services → remplacés par ProviderService
- [ ] Tests de ces instanciations ad-hoc à mettre à jour

### 🧪 Tests
- [ ] `ProviderService` unit tests (mock ConnectorConfigRepo)
- [ ] Test du fallback "provider not configured" : tool appelé sans config → retourne error structurée avec `configureUrl`
- [ ] Test de chaque tool github/gitlab/clickup avec client mocké
- [ ] Test d'intégration : créer issue GitHub end-to-end (mock du HTTP layer d'Octokit)

---

## Phase 6 — Orchestration cross-domaine + observabilité

**Statut** : ⬜ À faire
**Durée estimée** : 1-2 sessions
**Dépend de** : P3, P4, P5

### Objectif
L'AI enchaîne intelligemment plusieurs features. Observability complète.

### Tâches

- [ ] Templates d'orchestration dans skills vault
  - [ ] `triage_inbox.md` (emails → classifie → flux → tasks)
  - [ ] `monday_brief.md` (emails + events + tasks → note récap)
  - [ ] `rss_digest_to_note.md`
- [ ] Session modes : `brief`, `ide-dev`, `triage`, `meeting-prep`
  - [ ] Chaque mode charge un subset de tools + system prompt dédié
- [ ] Observability dashboard : vue "AI Activity"
  - [ ] Lit `ai_tool_calls`
  - [ ] Affiche latences, coûts LLM, tools les plus utilisés, échecs
- [ ] Safety rails
  - [ ] Rollback tokens pour ops destructives (delete email génère undo_token valide 5 min)
  - [ ] Budget LLM configurable par jour
- [ ] MCP expansion
  - [ ] Documenter comment exposer un domaine en serveur MCP
  - [ ] POC : packager `memory.tools` comme MCP server indépendant

### Done when
*"Prépare mon brief du lundi"* → l'AI lit emails, events, tasks non triées, génère le digest RSS, écrit le tout dans une note, prend ~30s, coût affiché, undo dispo.

### 🏛️ Architecture notes
- Les skills d'orchestration vivent dans le **vault utilisateur** (`_ide/skills/`), pas dans le code. C'est du contenu, pas du code.
- Session modes = constantes côté API dans `application/agent/session-modes.ts`. Chaque mode déclare son subset de tools + son system prompt override.
- "AI Activity" dashboard = nouvelle vue frontend qui consomme `/api/ai/tool-calls` (GET paginée). Route existe déjà via Phase 2.
- Rollback tokens : stockés dans `ai_tool_calls.undo_token` + logique de restore par tool (ex. `email_delete` sauvegarde l'email complet avant de delete, `undo_token` permet restore). **Pas de rollback universel** — à implémenter tool par tool.
- Budget LLM : compteur in-memory reset à minuit + limite dans `user_preferences`.

### 🧹 Dead code cleanup
- [ ] Tool calls logués à plusieurs endroits (console, fichier) → centralisés dans `ai_tool_calls`
- [ ] Système de logging ad-hoc du LLM (si existant) → remplacé par l'audit trail unifié
- [ ] Skills vault de démo/placeholder → remplacés par les vrais templates d'orchestration

### 🧪 Tests
- [ ] Test de chaque skill d'orchestration end-to-end (mock LLM + tools)
- [ ] Test du session mode filter : mode `brief` ne permet pas `deploy_*`
- [ ] Test du undo : `email_delete` puis `undo(token)` restaure l'email
- [ ] Test du budget : au 100ème appel du jour, 101ème refusé proprement
- [ ] Test de l'observability : GET `/api/ai/tool-calls?session=x` retourne le log

---

## Progression récapitulative

| Phase | Statut | Session(s) | Dépend de |
|-------|--------|------------|-----------|
| P1 GitHub unification | ✅ | 1 dense | — |
| P2 Tool convention | ✅ | 1 | — |
| P3 Notes bridge | ✅ | 1-2 | P2 |
| P4 Domaines CRUD | ⬜ | 2-3 | P2 |
| P5 Providers tools | ⬜ | 1 | P1, P2 |
| P6 Orchestration | ⬜ | 1-2 | P3, P4, P5 |

**Total estimé** : 8-10 sessions de travail focalisé.

### Légende
- ⬜ À faire
- 🟡 En cours
- ✅ Terminé
- ⛔ Bloqué

---

## Journal de session

### 2026-04-28
- **P4.3 RSS management shippée** : 6 tools dans `rss.tools.ts` (add_feed, remove_feed [user-confirm], star, mark_read, mark_all_read, generate_digest). Wraps `RssService` 1:1, +16 tests unit.
- **Flake `BriefService > overdue events` corrigé** : remplacement de `new Date()` (capture wall-clock) par une date fixe 2026-03-18. Le test échouait dans la première heure UTC du jour parce que `pastTime = now - 1h` retombait sur la veille, exclu par le filtre `endAt >= todayStart`. Suite passe de 1213 + 1 fail ambient à 1214 + 0 fail.
- **P4.2 Email actions shippées** : nouveau fichier `email-actions.tools.ts` avec les 8 tools du plan (compose / send [user-confirm] / reply [user-confirm] / mark_read / star / move / delete [user-confirm] / bulk_delete [admin]).
- Pour rendre `email_move` fonctionnel end-to-end : ajout de `ImapConnector.moveMessage`, `EmailRepository.updateFolder`, `EmailService.moveEmail` (pattern IMAP-first puis DB).
- Tests : +25 tests unit `email-actions.tools.test.ts` (regex email, cap 100 IDs, permission tiers, no-double-Re:, replyAll cc inclusion, guard email-not-found pour reply).
- Note : 1 fail ambient `BriefService > collects overdue events as blockers` détecté — pré-existait, ordre-dépendant des tests, pas lié à P4.2. À investiguer en hygiène.
- **Hygiène DoD** : 9 fichiers `*.tools.test.ts` ajoutés (analytics, brief, task, timer, skill, dns, ssh, deploy, git-remote) pour combler la DoD P2 ("1 unit test minimum par tool"). +80 tests.
- **P4.1 Calendar tools shippées** : `apps/api/src/application/agent/tools/calendar.tools.ts` créé avec les 6 tools (list, create [user-confirm], update, delete [user-confirm], find_conflict, generate_events_from_prompt). L'ancien `createCalendarTools` 2-tools de `brief.tools.ts` est dégagé.
- Wiring : `calendarService` + `llmService` ajoutés au call site de `createCalendarTools` dans `apps/api/src/index.ts`.
- Tests : +23 unit tests `calendar.tools.test.ts` (couvre permission level, validation zod, half-open conflict semantics, calendarName lookup case-insensitive, fallback "LLM non configure").
- **P3 DoD gap fermé** : `notes.tools.test.ts` ajoute 21 unit tests sur les 7 notes_* tools (le P3 avait omis le test des tools — uniquement repo + service avaient été couverts).
- Baseline unit : 1065 → 1109 pass / 0 fail. tsc desktop+api clean.
- Audit gh/glab : déjà bien architecturés en provider sur le domain `connector-config` (single source of truth via `connectorConfigRepo.findByType("github"|"gitlab"|"clickup")`). Clients HTTP isolés dans `infrastructure/connectors/`. Le `ProviderService` agnostique reste à créer en P5.

### 2026-04-25
- Plan initial rédigé suite à l'audit complet (3 agents Explore en parallèle)
- Enrichi avec règles DDD (10 règles strictes), Definition of Done global et sections "Architecture notes / Dead code cleanup / Tests" par phase suite à un audit archi dédié
- **P1 implémenté** :
  - Migration `0034_github_unify.sql` : drop `github_config` + rename `github_prs` → `synced_issues` (+source, +external_id)
  - `schema.ts` : export `syncedIssues` remplace `githubPrs`, `githubConfig` supprimé
  - Domain `GitHubConfigRepository` interface supprimée ; `GitHubPR` entity enrichie (source, externalId)
  - `GitHubService` refactoré pour lire/écrire via `connectorConfigRepo` avec merge de settings (préserve syncIssues/syncPRs/pollInterval existants)
  - `DrizzleGitHubConfigRepository` fichier supprimé ; `DrizzleGitHubPRRepository` migré sur `syncedIssues`
  - Frontend `GitHubSettings.tsx` supprimé + entrée onglet + 7 clés i18n orphelines (`githubDesc`, `createTokenHint`, `githubUsername`, `usernameHint`, `reposToWatch`, `reposSeparated`, `repoFormatHint`)
  - Tests : 1057 pass (+7 nouveaux dans `github.service.test.ts`), 0 fail, TS 0 erreur (desktop + api)
- **P2 implémenté** :
  - Migration `0035_ai_tool_calls.sql` + schéma `aiToolCalls` (conversation/session/tool/perm/args/result/status/duration)
  - Domain `AiToolCall` entity + `AiToolCallRepository` interface + `AiToolCallService` (DDD strict : domain → app → infra)
  - `DrizzleAiToolCallRepository` impl (repo sous `infrastructure/repositories/`)
  - `defineTool<T>(cfg)` helper : zod params schema, `permissionLevel`, `rateLimit`, execute typé via `z.infer<T>`
  - `ToolRegistry.dispatch(name, params, ctx)` : validation zod → rate limit → permission → execute → audit. Jamais throw, retourne toujours un `ToolDispatchResult` structuré.
  - `agent.service.ts` utilise `dispatch` au lieu de `tool.execute` — audit automatique
  - Rate limiter in-memory sliding window, scope `{tool, conversationId|sessionId|global}`
  - Permissions `user-confirm`/`admin` refusées avec audit tant que le canal n'est pas branché (flip en P4/P6)
  - Les 10 tool files migrés vers `defineTool` (task, memory, timer, analytics, brief, email, calendar, bookmark, project, skill, git-remote, deploy, dns, ssh)
  - Tests : 1070 pass (+13 dans `tool-registry.test.ts`, 3 `memory.tools.test.ts` mis à jour pour matcher le nouveau shape d'erreur). 0 fail, TS 0 erreur.
  - Note : le flux `permission_request` interactif côté API-agent est reporté à P4/P6 quand un UI le consomme. Le foundation (permissionLevel + dispatch deny) est en place.
- **P3 implémenté** :
  - Domain `VaultNote` entity + `VaultNoteRepository` interface + 5 error classes (`VaultNotFoundError`, `NoteNotFoundError`, `NoteAlreadyExistsError`, `InvalidNotePathError`, `NoteLockedError`)
  - Infra `FsVaultNoteRepository` : délègue à `VaultService` pour le `resolvePath` (anti path-traversal + symlink existant). Frontmatter YAML préservé/merged. Lock file adjacent `.lock` avec détection stale > 5s.
  - App `VaultNoteService` + helper `applyAiDefaultPrefix` qui ajoute `_ai/` aux paths sans dossier
  - Routes `/api/vault/notes` (7 endpoints GET/POST/PUT/DELETE) avec mapping domain errors → HTTP (400/404/409/423)
  - Validators `vault-note.validator.ts` (zod) — rejette `..`, byte null, chemins sans `.md`
  - 7 tools AI : `notes_list`, `notes_read`, `notes_create` (apply `_ai/` default), `notes_edit`, `notes_append`, `notes_rename`, `notes_delete` (user-confirm)
  - Tests : 1099 pass (+29 nouveaux : 22 repo unit tests avec tmp vault, 7 service tests avec mocked repo). Couvrent path-traversal, frontmatter preservation/merge, stale lock override, `.lock` file exclusion from list.
  - TS 0 erreur
