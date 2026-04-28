# Plan v1 finale Cookia

## Vue d'ensemble — 4 chantiers

| # | Chantier | Complexité | Dépendances |
|---|---|---|---|
| 3 | Sélecteur de mode de session UI | Faible | Aucune |
| 4B | Gemini comme provider | Faible | Aucune |
| 4A | Boutons "Ask Cookia" cross-views | Moyenne | cookiaContextStore |
| 1 | Slash commands exhaustifs | Moyenne | — |
| 2 | Remote control (QR code mobile) | Haute | Chantier 1 |

---

## Chantier 1 — Slash commands exhaustifs

### Architecture : intercepteur local dans AiChatContent

Le texte saisi dans AiComposer remonte via `onSend`. AiChatContent intercepte avant de router.
Si le contenu commence par `/`, un dispatcher local analyse la commande.
Jamais envoyé au LLM sauf pour les commandes LLM-assisted.

### Classification des commandes

**LOCAL (zéro appel LLM, provider-agnostic) :**
- `/help` — message system dans le feed, liste les commandes
- `/clear` — appelle `ai.clearMessages(sessionId)`
- `/model` — ouvre le dialog de config existant dans AiTerminalTabs (message d'erreur si claude-cli)
- `/config` — appelle `openSettings("llm")`
- `/permissions` — affiche les capabilities de la session courante
- `/vim` — toggle vimMode dans AiComposer
- `/status` — affiche `session.capabilities`, `session.model`, `session.phase`
- `/mcp` — toggle du ContextPanel MCP existant
- `/resume` — ouvre PastSessionViewer (déjà implémenté)
- `/remote-control` — déclenche le flow QR code (Chantier 2)

**LLM-ASSISTED (prompt structuré envoyé au LLM actif) :**
- `/compact` — résumé des N derniers messages via le LLM actif, remplace les anciens messages dans le feed local. Provider-agnostic.
- `/cost` — tokens de la session. Source : events stream (anthropic/openai) ou non supporté (ollama/lmstudio). Message system dans le feed.
- `/memory` — affiche `agent_memories` DB (providers API) ou contenu CLAUDE.md (claude-cli).
- `/init` — pour claude-cli : injecte `/init` dans le flux natif. Pour autres : génère CLAUDE.md via LLM + analyse fileTree.
- `/review` — git diff via Tauri + prompt de code review. Provider-agnostic.

**Règle claude-cli :** si une commande LLM-assisted est exécutée avec claude-cli, injecter le texte brut de la commande comme message utilisateur (claude-cli le gère nativement).

### Fichiers

**Créer :**
- `apps/desktop/src/ui/components/ide/slashCommands.ts` — registre (type `SlashCommand`, liste, dispatcher)

**Modifier :**
- `apps/desktop/src/ui/components/ide/AiChatContent.tsx` — intercepteur slash avant `ai.sendMessage()`
- `apps/desktop/src/ui/components/ide/AiComposer.tsx` — picker autocomplete `/` (même pattern que `@` mention picker)
- `apps/desktop/src/application/stores/aiSessionStore.ts` — `injectSystemMessage(sessionId, content)`

### Pièges
- Picker slash : activer uniquement si `/` est en début de ligne ou après espace + cursor au début du contenu (éviter les URLs)
- `/compact` opère sur le feed local uniquement, ne modifie pas la session côté LLM
- Pour claude-cli : injecter le texte brut, ne pas réimplémenter les commandes natives

---

## Chantier 2 — Remote Control (QR code mobile)

### Architecture : serveur HTTP local Tauri + relay VPS

1. Rust génère un UUID token, ouvre un listener WebSocket sur `127.0.0.1:PORT` dynamique
2. QR code → `https://[VPS_HOST]/cookia-relay?token=TOKEN&host=[LOCAL_IP]&port=PORT`
3. Le VPS (VpsProxyService déjà configuré) joue le rôle de relay HTTPS → WebSocket local
4. Page web mobile statique hébergée sur le VPS (HTML/JS vanilla)

Le WebSocket local reçoit `{ type: "send_message", content }` et injecte dans la session via `SessionManager`.
Il diffuse les `AdapterEvent` de la session vers le client mobile.

Token TTL : 30 min max. Fermeture propre quand connexion mobile fermée.

### Fichiers

**Créer :**
- `apps/desktop/src-tauri/src/remote_control.rs` — serveur WS local, commands Tauri `ai_start_remote_session`, `ai_stop_remote_session`
- `apps/desktop/src/ui/components/ide/RemoteControlModal.tsx` — affichage QR code + URL + bouton arrêter
- `apps/api/src/presentation/routes/relay.routes.ts` — proxy WS côté VPS

**Modifier :**
- `apps/desktop/src-tauri/src/lib.rs` — enregistrer module + commands
- `apps/desktop/src/ui/components/ide/slashCommands.ts` — impl `/remote-control`

### Pièges
- Retry sur port suivant si le port est occupé (pare-feu, conflit)
- TTL 30 min, refuser les tokens expirés
- VPS doit fermer la connexion WS locale quand le mobile se déconnecte
- **Si temps manque pour v1** : version dégradée = QR code pointant vers page statique VPS avec token dans l'URL, sans relay dynamique

---

## Chantier 3 — Sélecteur de mode de session UI

### Architecture : signal local dans AiChatContent + injection dans contextParts

Le mode est un signal SolidJS local à `AiChatContent`, initialisé à `"general"`. Non persisté entre sessions.

Au premier `handleSend`, si mode ≠ `"general"`, le hint du mode est ajouté dans `contextParts[]` après le CLAUDE.md.

Le sélecteur est placé **dans la barre des sub-tabs** (à droite des onglets Session/Diffs/Processes/Files/Validation).

Les définitions de modes côté frontend sont dupliquées dans un fichier dédié (évite une dépendance inter-app).

### Fichiers

**Créer :**
- `apps/desktop/src/ui/components/ide/sessionModes.ts` — labels, descriptions, prompt hints des modes (duplication contrôlée depuis `session-modes.ts` API)

**Modifier :**
- `apps/desktop/src/ui/components/ide/AiChatContent.tsx` — signal `sessionMode`, sélecteur UI dans la toolbar des tabs, injection dans `contextParts`
- `apps/desktop/src/i18n/fr.ts` + `en.ts` — labels des modes

### Pièges
- N'injecter le mode qu'au même moment que le CLAUDE.md (pas deux vecteurs d'injection séparés)
- Pour claude-cli, mettre le hint de mode en fin de `contextParts` (plus proche du message utilisateur)

---

## Chantier 4A — Boutons "Ask Cookia" cross-views

### Architecture : `cookiaContextStore` + pre-fill AiComposer

Signal global `pendingCookiaContext: { prompt: string, source: string } | null`.
Un bouton "Ask Cookia" dans une vue :
1. Construit le prompt contextuel
2. Écrit dans `setCookiaContext({ prompt, source })`
3. Appelle `setViewMode("ide")`

AiChatContent lit `cookiaContext()` et **pré-remplit AiComposer** (sans auto-envoyer — l'utilisateur confirme).

### Prompts contextuels par vue

- **Email** : `"[Email de ${fromName}]\nSujet: ${subject}\n\n${bodyText.slice(0,2000)}"`
- **RSS article** : `"[Article RSS: ${feedLabel}]\nTitre: ${title}\n\n${bodyText.slice(0,2000)}"`
- **Snippet** : `"[Snippet: ${title}]\n\`\`\`${language}\n${content}\n\`\`\`\n\nAnalyse ce code."`
- **Task** : `"[Tâche: ${name}]\nPriorité: ${priority}\n${description ?? ''}\n\nQue faire pour avancer ?"`
- **Flux global** : `"Aide-moi à trier mon inbox."` + auto-set mode `triage`

### Fichiers

**Créer :**
- `apps/desktop/src/application/stores/cookiaContextStore.ts`

**Modifier :**
- `apps/desktop/src/ui/components/ide/AiChatContent.tsx` — lire `cookiaContext()`
- `apps/desktop/src/ui/components/ide/AiComposer.tsx` — prop `initialText?: string`
- `apps/desktop/src/ui/components/email/EmailDetail.tsx`
- `apps/desktop/src/ui/components/rss/RssView.tsx`
- `apps/desktop/src/ui/components/snippets/SnippetView.tsx`
- `apps/desktop/src/ui/components/tasks/TaskDetail.tsx`
- `apps/desktop/src/ui/components/sidebar/FluxSidebarContent.tsx`

---

## Chantier 4B — Gemini comme provider

### Architecture : OpenAI-compatible endpoint Google

Google Gemini expose `https://generativelanguage.googleapis.com/v1beta/openai/` en format OpenAI-compatible.
Auth header : `Authorization: Bearer {api_key}` — identique à OpenAI.
Pas besoin d'adapter dédié.

### Fichiers

**Modifier :**
- `apps/desktop/src-tauri/src/ai/adapters/http_api.rs` — `ApiProvider::Gemini`, `default_base_url()` Gemini
- `apps/desktop/src-tauri/src/ai/session_manager.rs` — `"gemini-api"` dans `detect_providers()` + `create_adapter()`
- `apps/desktop/src/ui/components/ide/AiTerminalTabs.tsx` — `"gemini-api"` dans `DEFAULT_MODELS` (`["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]`) + `needsApiKey()`
- `apps/api/src/application/llm/llm.service.ts` — `"gemini"` dans `createAdapter()` → `OpenAICompatibleAdapter` avec base URL Gemini
- `apps/api/src/domain/llm/llm-config.entity.ts` — documenter `"gemini"` comme valeur valide

---

## Ordre d'implémentation recommandé

```
1. Chantier 3 — session mode selector  (simple, valeur immédiate, zéro dépendance)
2. Chantier 4B — Gemini                (modification mineure Rust + TS, zéro dépendance)
3. Chantier 4A — Ask Cookia buttons    (cookiaContextStore + boutons dans 5 vues)
4. Chantier 1 — slash commands         (registre → picker UI → commandes LOCAL → LLM-assisted)
5. Chantier 2 — remote control         (le plus complexe, dépend de /remote-control dans Chantier 1)
```

---

## Récap provider-agnostic vs Claude-CLI-specific

| Feature | Agnostic | CLI-only |
|---|---|---|
| `/help`, `/clear`, `/config`, `/status`, `/permissions`, `/resume`, `/vim`, `/mcp`, `/remote-control` | ✅ | — |
| `/compact`, `/review` | ✅ | — |
| `/model` | ✅ dialog | ⚠️ erreur + conseil |
| `/cost` | ⚠️ parsing events | ✅ natif |
| `/memory` | ⚠️ DB agent_memories | ✅ fichiers .claude/ |
| `/init` | ⚠️ via LLM + fileTree | ✅ natif |
| Mode de session | ✅ injection prompt | — |
| Boutons Ask Cookia | ✅ | — |
| Gemini | ✅ OpenAI-compat | — |
