# Plan v1 finale Cookia — TDD

## Principes TDD appliqués au projet

**Pattern existant à respecter :** extraire la logique pure hors des composants/stores SolidJS
→ la tester en isolation avec `bun:test`. Pas de test DOM/réactif.

**Workflow par chantier :**
1. Créer le fichier de test avec les `describe/it` → RED (`bun test` ou `cargo test` échoue)
2. Implémenter pour faire passer → GREEN
3. Refactorer si nécessaire → REFACTOR

**Commandes de test :**
```bash
# API (bash runner Windows-safe)
cd apps/api && bun run test

# Desktop (run direct, pas de script test encore)
cd apps/desktop && bun test src/__tests__/unit/<fichier>.test.ts

# Rust
cd apps/desktop/src-tauri && cargo test
```

> **Action préalable :** ajouter `"test": "bun test src/__tests__/unit"` dans `apps/desktop/package.json`
> pour pouvoir lancer `bun run --filter desktop test` depuis la racine.

---

## Ordre global d'implémentation

```
1. Chantier 3 — session mode selector   (zéro dépendance, plus simple)
2. Chantier 4B — Gemini provider        (zéro dépendance, Rust + TS)
3. Chantier 4A — Ask Cookia buttons     (dépend de cookiaContextStore)
4. Chantier 1 — Slash commands          (slashCommands.ts → picker → handlers)
5. Chantier 2 — Remote control          (dépend du registre slash du Chantier 1)
```

---

## Chantier 3 — Sélecteur de mode de session

### Architecture

Signal local `sessionMode` dans `AiChatContent`, initialisé à `"general"`. Non persisté entre sessions.
Au premier `handleSend` (quand `contextInjected()` passe à `true`), le hint du mode est ajouté
dans `contextParts[]` en dernier (après CLAUDE.md + workflow), si mode ≠ `"general"`.

Sélecteur placé dans la barre sub-tabs d'AiChatContent (à droite des onglets Session/Diffs/…).

Les métadonnées des modes sont dupliquées côté frontend dans `sessionModes.ts`
(évite une dépendance inter-app sur `apps/api`).

### Étape 1 — RED : écrire les tests

**Fichier :** `apps/desktop/src/__tests__/unit/sessionModes.test.ts`

```typescript
// Tests à écrire AVANT d'implémenter sessionModes.ts
describe("sessionModes", () => {
  describe("ALL_MODES", () => {
    it("contient exactement les 5 modes définis", () => { /* ... */ });
    it("chaque mode a un id, label, description, promptHint", () => { /* ... */ });
  });

  describe("getModeHint", () => {
    it("retourne null pour 'general'", () => { /* ... */ });
    it("retourne une string non-vide pour 'brief'", () => { /* ... */ });
    it("retourne une string non-vide pour tous les modes non-general", () => { /* ... */ });
  });

  describe("getModeLabel", () => {
    it("retourne le label FR pour 'general'", () => { /* ... */ });
    it("retourne le label FR pour chaque mode", () => { /* ... */ });
  });
});

describe("buildModeContextPart", () => {
  it("retourne null si mode = 'general'", () => { /* ... */ });
  it("retourne une string commençant par '[Mode:' pour 'brief'", () => { /* ... */ });
  it("inclut le promptHint dans la string retournée", () => { /* ... */ });
});
```

**Fichier :** `apps/desktop/src/__tests__/unit/contextInjection.test.ts`

```typescript
// Tester la fonction pure qui construit contextParts
describe("buildContextParts", () => {
  it("n'inclut pas le mode si general", () => { /* ... */ });
  it("inclut le mode hint en dernière position si mode != general", () => { /* ... */ });
  it("inclut le CLAUDE.md si fourni", () => { /* ... */ });
  it("inclut le workflow si fourni", () => { /* ... */ });
  it("retourne [] si aucun contexte fourni et mode = general", () => { /* ... */ });
});
```

### Étape 2 — GREEN : implémenter

**Créer :**
- `apps/desktop/src/ui/components/ide/sessionModes.ts`
  - `ALL_MODES: SessionMode[]` (id, label, description, promptHint)
  - `getModeHint(mode: string): string | null`
  - `getModeLabel(mode: string): string`
  - `buildModeContextPart(mode: string): string | null`

- `apps/desktop/src/ui/components/ide/contextInjection.ts`
  - `buildContextParts(opts: { mode, claudeMd, workflow }): string[]`
  - Fonction pure, extraite de `AiChatContent.handleSend`

**Modifier :**
- `apps/desktop/src/ui/components/ide/AiChatContent.tsx`
  - Ajouter signal `sessionMode`
  - Ajouter sélecteur pills dans la toolbar
  - Remplacer la construction inline de `contextParts` par `buildContextParts()`
- `apps/desktop/src/i18n/fr.ts` + `en.ts` — labels des modes

### Pièges
- Ne pas injecter le mode si `contextInjected()` est déjà `true` (injection une seule fois)
- Pour claude-cli : mettre le hint de mode en dernier dans `contextParts` (plus proche du message)

---

## Chantier 4B — Gemini comme provider

### Architecture

Gemini expose `https://generativelanguage.googleapis.com/v1beta/openai/` en OpenAI-compatible.
Auth : `Authorization: Bearer {api_key}`. Pas d'adapter dédié.

Côté Rust : ajouter `"gemini-api"` dans `session_manager.rs` + `http_api.rs`.
Côté API Hono : router `"gemini"` vers `OpenAICompatibleAdapter` avec base URL Gemini.
Côté frontend : ajouter `"gemini-api"` dans `DEFAULT_MODELS` + `needsApiKey()`.

### Étape 1 — RED : écrire les tests

**Fichier :** `apps/desktop/src/__tests__/unit/providerConfig.test.ts`

```typescript
// Tester la logique pure de configuration provider (extraite de AiTerminalTabs)
describe("getDefaultModels", () => {
  it("retourne les modèles Gemini pour 'gemini-api'", () => {
    expect(getDefaultModels("gemini-api")).toContain("gemini-2.0-flash");
  });
  it("retourne des modèles pour tous les providers connus", () => { /* ... */ });
  it("retourne [] pour un provider inconnu", () => { /* ... */ });
});

describe("needsApiKey", () => {
  it("retourne true pour 'gemini-api'", () => {
    expect(needsApiKey("gemini-api")).toBe(true);
  });
  it("retourne false pour 'ollama'", () => { /* ... */ });
  it("retourne true pour 'anthropic-api'", () => { /* ... */ });
});

describe("getProviderLabel", () => {
  it("retourne 'Gemini' pour 'gemini-api'", () => { /* ... */ });
});
```

**Fichier :** `apps/api/src/__tests__/unit/llm.service.gemini.test.ts`

```typescript
describe("LlmService — Gemini", () => {
  it("crée un OpenAICompatibleAdapter pour provider 'gemini'", async () => {
    // mock configRepo.getActive() → { provider: "gemini", apiKey: "key", ... }
    // mock adapter.chat → "response"
    // verify: OpenAICompatibleAdapter instancié avec baseUrl Gemini
  });

  it("lève une erreur si apiKey absent pour gemini", async () => {
    // mock configRepo.getActive() → { provider: "gemini", apiKey: null }
    // expect: throw "API key required"
  });
});
```

**Fichier :** `apps/desktop/src-tauri/src/ai/session_manager.rs` (inline `#[cfg(test)]`)

```rust
#[test]
fn test_gemini_provider_detected() {
    // SessionConfig { provider: "gemini-api", ... }
    // SessionManager::detect_capabilities("gemini-api") 
    // → capabilities.supports_streaming = true
}

#[test]
fn test_gemini_base_url() {
    // HttpApiConfig pour "gemini-api"
    // → base_url contient "generativelanguage.googleapis.com"
}
```

### Étape 2 — GREEN : implémenter

**Créer :**
- `apps/desktop/src/ui/components/ide/providerConfig.ts`
  - `getDefaultModels(provider: string): string[]`
  - `needsApiKey(provider: string): boolean`
  - `getProviderLabel(provider: string): string`
  - Extraire depuis `AiTerminalTabs.tsx` (actuellement inline)

**Modifier :**
- `apps/desktop/src-tauri/src/ai/adapters/http_api.rs` — `ApiProvider::Gemini`, `default_base_url()`
- `apps/desktop/src-tauri/src/ai/session_manager.rs` — `"gemini-api"` dans `detect_capabilities()` + `create_adapter()`
- `apps/desktop/src/ui/components/ide/AiTerminalTabs.tsx` — utiliser `providerConfig.ts` au lieu des données inline
- `apps/api/src/application/llm/llm.service.ts` — case `"gemini"` dans `createAdapter()` → `OpenAICompatibleAdapter` avec base URL Gemini
- `apps/api/src/domain/llm/llm-config.entity.ts` — type union inclut `"gemini"`

### Pièges
- Ne pas oublier d'ajouter `"gemini-api"` au badge display dans `AiTerminalTabs` (actuellement `"CC"`, `"GPT"`, `"OL"` etc.)
- L'`OpenAICompatibleAdapter` côté API prend `(baseUrl, apiKey)` — s'assurer que la base URL Gemini est passée correctement

---

## Chantier 4A — Boutons "Ask Cookia" cross-views

### Architecture

Store partagé `cookiaContextStore.ts` avec un signal `pendingContext: { prompt, source } | null`.
Un bouton "Ask Cookia" dans une vue :
1. Appelle `buildXxxPrompt(item)` (fonction pure) → string
2. Écrit dans `setCookiaContext({ prompt, source })`
3. Appelle `navigate("ide")` ou `setViewMode("ide")`

`AiChatContent` lit `cookiaContext()` et pré-remplit `AiComposer` via une prop `initialText`.
L'utilisateur voit le message pré-rempli, peut modifier, et confirme (pas d'auto-envoi).

### Étape 1 — RED : écrire les tests

**Fichier :** `apps/desktop/src/__tests__/unit/cookiaContextStore.test.ts`

```typescript
describe("cookiaContextStore", () => {
  beforeEach(() => clearCookiaContext());

  it("démarre à null", () => {
    expect(getCookiaContext()).toBeNull();
  });

  it("setCookiaContext stocke prompt + source", () => {
    setCookiaContext({ prompt: "Résume cet email", source: "email" });
    expect(getCookiaContext()).toEqual({ prompt: "Résume cet email", source: "email" });
  });

  it("clearCookiaContext remet à null", () => {
    setCookiaContext({ prompt: "test", source: "rss" });
    clearCookiaContext();
    expect(getCookiaContext()).toBeNull();
  });

  it("setCookiaContext écrase le contexte précédent", () => {
    setCookiaContext({ prompt: "premier", source: "email" });
    setCookiaContext({ prompt: "second", source: "rss" });
    expect(getCookiaContext()?.prompt).toBe("second");
  });
});
```

**Fichier :** `apps/desktop/src/__tests__/unit/cookiaPromptBuilders.test.ts`

```typescript
describe("buildEmailPrompt", () => {
  it("inclut le nom de l'expéditeur", () => {
    const prompt = buildEmailPrompt({ from: "alice@ex.com", subject: "Sujet", bodyText: "Corps" });
    expect(prompt).toContain("alice@ex.com");
  });
  it("tronque bodyText à 2000 chars", () => {
    const long = "x".repeat(3000);
    const prompt = buildEmailPrompt({ from: "a@b.com", subject: "s", bodyText: long });
    expect(prompt.length).toBeLessThan(2200);
  });
  it("inclut le sujet", () => { /* ... */ });
});

describe("buildRssPrompt", () => {
  it("inclut le feedLabel et le titre", () => { /* ... */ });
  it("tronque bodyText à 2000 chars", () => { /* ... */ });
  it("inclut le lien si présent", () => { /* ... */ });
});

describe("buildSnippetPrompt", () => {
  it("wrap le code dans un bloc markdown avec le bon langage", () => {
    const prompt = buildSnippetPrompt({ title: "Helper", language: "typescript", content: "const x = 1" });
    expect(prompt).toContain("```typescript");
    expect(prompt).toContain("const x = 1");
  });
});

describe("buildTaskPrompt", () => {
  it("inclut le nom et la priorité", () => { /* ... */ });
  it("gère description null", () => { /* ... */ });
});

describe("buildFluxTriagePrompt", () => {
  it("retourne le prompt de triage", () => {
    expect(buildFluxTriagePrompt()).toContain("trier");
  });
});
```

### Étape 2 — GREEN : implémenter

**Créer :**
- `apps/desktop/src/application/stores/cookiaContextStore.ts`
  - `getCookiaContext()`, `setCookiaContext()`, `clearCookiaContext()` (fonctions exportées, pas de hook)

- `apps/desktop/src/ui/components/ide/cookiaPromptBuilders.ts`
  - `buildEmailPrompt(email)`, `buildRssPrompt(article)`, `buildSnippetPrompt(snippet)`, `buildTaskPrompt(task)`, `buildFluxTriagePrompt()`

**Modifier :**
- `apps/desktop/src/ui/components/ide/AiChatContent.tsx` — lire `cookiaContext()`, pré-remplir via `AiComposer`
- `apps/desktop/src/ui/components/ide/AiComposer.tsx` — prop `initialText?: string`
- `apps/desktop/src/ui/components/email/EmailDetail.tsx` — bouton "Demander à Cookia"
- `apps/desktop/src/ui/components/rss/RssView.tsx` — bouton "Demander à Cookia" sur article
- `apps/desktop/src/ui/components/snippets/SnippetView.tsx` — bouton "Demander à Cookia"
- `apps/desktop/src/ui/components/tasks/TaskDetail.tsx` — bouton "Demander à Cookia"
- `apps/desktop/src/ui/components/sidebar/FluxSidebarContent.tsx` — bouton "Trier avec Cookia" (+ set mode triage)

### Pièges
- Ne pas auto-envoyer : pré-remplir le Composer, l'utilisateur valide
- Après pré-remplissage, appeler `clearCookiaContext()` pour éviter la re-injection au retour sur la vue IDE
- FluxSidebarContent doit aussi setter le mode de session à `"triage"` (via un second signal dans le store ou via `cookiaContextStore` enrichi avec `mode?`)

---

## Chantier 1 — Slash commands

### Architecture

Intercepteur dans `AiChatContent.handleSend` : si le texte commence par `/`, dispatcher local.
Picker autocomplete dans `AiComposer` (même pattern que le `@` mention picker existant).
Jamais envoyé au LLM sauf pour les commandes LLM-assisted.

Pour claude-cli : injecter le texte brut de la commande (claude-cli le gère nativement).

### Étape 1 — RED : écrire les tests

**Fichier :** `apps/desktop/src/__tests__/unit/slashCommands.test.ts`

```typescript
describe("parseSlashCommand", () => {
  it("retourne null si le texte ne commence pas par /", () => {
    expect(parseSlashCommand("hello /help")).toBeNull();
  });
  it("parse '/help' → { command: 'help', args: [] }", () => {
    expect(parseSlashCommand("/help")).toEqual({ command: "help", args: [] });
  });
  it("parse '/compact 10' → { command: 'compact', args: ['10'] }", () => {
    expect(parseSlashCommand("/compact 10")).toEqual({ command: "compact", args: ["10"] });
  });
  it("retourne null pour une chaîne vide", () => {
    expect(parseSlashCommand("")).toBeNull();
  });
  it("est case-insensitive pour le nom de commande", () => {
    expect(parseSlashCommand("/Help")?.command).toBe("help");
  });
});

describe("isSlashTrigger", () => {
  it("retourne true si '/' est le premier caractère", () => {
    expect(isSlashTrigger("/", 1)).toBe(true);
  });
  it("retourne false si '/' est au milieu du texte", () => {
    expect(isSlashTrigger("hello /help", 7)).toBe(false);
  });
  it("retourne true si '/' est après un espace en début", () => {
    // "/" seul après effacement de tout le texte
    expect(isSlashTrigger("/", 1)).toBe(true);
  });
});

describe("filterCommands", () => {
  it("retourne toutes les commandes si query vide", () => {
    expect(filterCommands("").length).toBeGreaterThan(5);
  });
  it("filtre par préfixe de nom", () => {
    const results = filterCommands("comp");
    expect(results.map(c => c.name)).toContain("compact");
  });
  it("ne retourne pas de doublons", () => {
    const results = filterCommands("");
    const names = results.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("SLASH_COMMANDS registre", () => {
  it("contient /help", () => {
    expect(SLASH_COMMANDS.find(c => c.name === "help")).toBeDefined();
  });
  it("contient /clear", () => { /* ... */ });
  it("contient /compact", () => { /* ... */ });
  it("contient /remote-control", () => { /* ... */ });
  it("chaque commande a name, description, level (local|llm-assisted)", () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(["local", "llm-assisted"]).toContain(cmd.level);
    }
  });
});
```

**Fichier :** `apps/desktop/src/__tests__/unit/slashHandlers.test.ts`

```typescript
describe("buildCompactPrompt", () => {
  it("retourne null si aucun message assistant dans l'historique", () => {
    expect(buildCompactPrompt([])).toBeNull();
  });
  it("inclut les N derniers messages dans le prompt", () => {
    const messages = [
      { role: "user", content: "bonjour" },
      { role: "assistant", content: "salut" },
    ];
    const prompt = buildCompactPrompt(messages);
    expect(prompt).toContain("Résume");
    expect(prompt).toContain("salut");
  });
  it("tronque à MAX_COMPACT_MESSAGES messages", () => { /* ... */ });
});

describe("buildHelpMessage", () => {
  it("liste toutes les commandes disponibles", () => {
    const msg = buildHelpMessage(SLASH_COMMANDS);
    expect(msg).toContain("/help");
    expect(msg).toContain("/compact");
    expect(msg).toContain("/clear");
  });
  it("indique le niveau (local / LLM) pour chaque commande", () => { /* ... */ });
});

describe("buildReviewPrompt", () => {
  it("inclut le diff git dans le prompt", () => {
    const prompt = buildReviewPrompt("diff --git a/foo.ts ...\n+const x = 1");
    expect(prompt).toContain("diff --git");
  });
  it("retourne null si diff vide", () => {
    expect(buildReviewPrompt("")).toBeNull();
  });
});

describe("isClaudeCliProvider", () => {
  it("retourne true pour 'claude-cli'", () => {
    expect(isClaudeCliProvider("claude-cli")).toBe(true);
  });
  it("retourne false pour 'anthropic-api'", () => { /* ... */ });
});
```

**Fichier :** `apps/api/src/__tests__/unit/ai-session.injectMessage.test.ts` (côté API — si `injectSystemMessage` est exposé via API)

```typescript
// Si injectSystemMessage modifie la session côté store TS (aiSessionStore frontend)
// → tester via la logique pure qui construit le message system
describe("makeSystemMessage", () => {
  it("crée un message avec role 'system' et le content fourni", () => {
    const msg = makeSystemMessage("Liste des commandes : /help");
    expect(msg.role).toBe("system");
    expect(msg.content).toContain("/help");
  });
  it("génère un id unique", () => {
    const a = makeSystemMessage("a");
    const b = makeSystemMessage("b");
    expect(a.id).not.toBe(b.id);
  });
});
```

### Étape 2 — GREEN : implémenter

**Créer :**
- `apps/desktop/src/ui/components/ide/slashCommands.ts`
  - `type SlashCommand = { name, description, level, aliases? }`
  - `SLASH_COMMANDS: SlashCommand[]` — registre complet
  - `parseSlashCommand(text: string): { command, args } | null`
  - `isSlashTrigger(text: string, cursorPos: number): boolean`
  - `filterCommands(query: string): SlashCommand[]`

- `apps/desktop/src/ui/components/ide/slashHandlers.ts`
  - `buildCompactPrompt(messages: Message[]): string | null`
  - `buildHelpMessage(commands: SlashCommand[]): string`
  - `buildReviewPrompt(diff: string): string | null`
  - `isClaudeCliProvider(provider: string): boolean`
  - `makeSystemMessage(content: string): Message`

**Modifier :**
- `apps/desktop/src/ui/components/ide/AiChatContent.tsx` — intercepteur slash dans `handleSend`
- `apps/desktop/src/ui/components/ide/AiComposer.tsx` — picker autocomplete `/` (même pattern que `@`)
- `apps/desktop/src/application/stores/aiSessionStore.ts` — `injectSystemMessage(sessionId, message)`

### Classification des commandes (registre)

| Commande | Level | Provider-agnostic |
|---|---|---|
| `/help` | local | Oui |
| `/clear` | local | Oui |
| `/model` | local | Oui (dialog) / erreur si claude-cli |
| `/config` | local | Oui |
| `/permissions` | local | Oui |
| `/vim` | local | Oui |
| `/status` | local | Oui |
| `/mcp` | local | Oui |
| `/resume` | local | Oui |
| `/remote-control` | local | Oui |
| `/compact` | llm-assisted | Oui |
| `/cost` | llm-assisted | Partiel (parsing events) |
| `/memory` | llm-assisted | Partiel (DB vs fichiers .claude/) |
| `/init` | llm-assisted | Partiel (natif vs via LLM) |
| `/review` | llm-assisted | Oui |

### Pièges
- Picker slash : activer uniquement si `/` est le premier caractère du composer (pas dans une URL)
- `/compact` opère sur le feed local uniquement (pas la session côté LLM)
- Pour claude-cli : injecter le texte brut, ne pas réimplémenter les commandes natives

---

## Chantier 2 — Remote Control (QR code mobile)

### Architecture

1. Rust génère un UUID token + ouvre WebSocket sur `127.0.0.1:PORT` dynamique
2. QR code → `https://[VPS_HOST]/cookia-relay?token=TOKEN&host=[LOCAL_IP]&port=PORT`
3. VPS relay HTTPS → WebSocket local (VpsProxyService déjà disponible)
4. Page web mobile statique hébergée sur le VPS (HTML/JS vanilla)

Token TTL : 30 min. Fallback si trop complexe : QR code → URL statique sans relay dynamique.

### Étape 1 — RED : écrire les tests

**Fichier Rust :** `apps/desktop/src-tauri/src/remote_control.rs` (inline `#[cfg(test)]`)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_valid_uuid() {
        let token = generate_token();
        // UUID v4 format: 8-4-4-4-12
        assert_eq!(token.len(), 36);
        assert_eq!(token.chars().filter(|c| *c == '-').count(), 4);
    }

    #[test]
    fn token_not_expired_immediately() {
        let created = std::time::Instant::now();
        assert!(!is_token_expired(created, 30));
    }

    #[test]
    fn token_expired_after_ttl() {
        // Simuler un token créé il y a 31 minutes
        let old = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(31 * 60))
            .unwrap_or(std::time::Instant::now());
        // Note: Instant::checked_sub n'existe pas — utiliser SystemTime dans l'impl
        // Ce test documente le comportement attendu
        assert!(is_token_expired_at(0, 30 * 60 + 1)); // seconds_elapsed > ttl_secs
    }

    #[test]
    fn relay_url_built_correctly() {
        let url = build_relay_url("abc123", "https://vps.example.com", 8765);
        assert!(url.contains("abc123"));
        assert!(url.contains("vps.example.com"));
        assert!(url.contains("8765"));
    }
}
```

**Fichier :** `apps/desktop/src/__tests__/unit/remoteControl.test.ts`

```typescript
describe("buildRelayUrl", () => {
  it("inclut le token dans l'URL", () => {
    const url = buildRelayUrl({ token: "abc-123", vpsHost: "https://vps.example.com", port: 9000 });
    expect(url).toContain("abc-123");
  });
  it("inclut le host VPS", () => {
    const url = buildRelayUrl({ token: "t", vpsHost: "https://myserver.io", port: 9000 });
    expect(url).toContain("myserver.io");
  });
  it("inclut le port local", () => {
    const url = buildRelayUrl({ token: "t", vpsHost: "https://x.io", port: 1234 });
    expect(url).toContain("1234");
  });
  it("génère une URL HTTPS valide", () => {
    const url = buildRelayUrl({ token: "t", vpsHost: "https://x.io", port: 9000 });
    expect(url.startsWith("https://")).toBe(true);
  });
});

describe("formatSessionInfo", () => {
  it("retourne le token masqué pour l'affichage", () => {
    const info = formatSessionInfo({ token: "abc-def-ghi", port: 9000, expiresAt: new Date() });
    expect(info.tokenPreview).toMatch(/abc.*\*+/);
  });
});
```

**Fichier API :** `apps/api/src/__tests__/unit/relay.routes.test.ts`

```typescript
describe("relay routes", () => {
  it("GET /relay/:token retourne 404 pour token inconnu", async () => {
    const res = await request("GET", "/api/relay/unknown-token-123");
    expect(res.status).toBe(404);
  });

  it("POST /relay/register enregistre un token + callback URL", async () => {
    const res = await request("POST", "/api/relay/register", {
      token: "test-token",
      callbackUrl: "ws://127.0.0.1:9000",
    });
    expect(res.status).toBe(201);
  });
});
```

### Étape 2 — GREEN : implémenter

**Créer :**
- `apps/desktop/src-tauri/src/remote_control.rs`
  - `generate_token() -> String` (UUID v4)
  - `is_token_expired_at(seconds_elapsed: u64, ttl_secs: u64) -> bool`
  - `build_relay_url(token: &str, vps_host: &str, port: u16) -> String`
  - Commands Tauri : `ai_start_remote_session`, `ai_stop_remote_session`
  - Serveur WebSocket local (tokio + tokio-tungstenite)

- `apps/desktop/src/ui/components/ide/RemoteControlModal.tsx`
  - Affichage QR code + URL + timer TTL + bouton arrêter

- `apps/desktop/src/ui/components/ide/remoteControl.ts`
  - `buildRelayUrl(opts)`, `formatSessionInfo(info)` — fonctions pures

- `apps/api/src/presentation/routes/relay.routes.ts`
  - `POST /relay/register` — enregistre `token → callbackUrl`
  - `GET /relay/:token` — proxy WebSocket vers l'URL locale

**Modifier :**
- `apps/desktop/src-tauri/src/lib.rs` — enregistrer module + commands
- `apps/desktop/src/ui/components/ide/slashCommands.ts` — impl `/remote-control`
- `apps/api/src/index.ts` — `app.route("/api/relay", createRelayRoutes())`

### Pièges
- Retry sur port suivant si le port est occupé (pare-feu, conflit)
- TTL 30 min, refuser les tokens expirés côté VPS
- VPS doit fermer la connexion WS locale quand le mobile se déconnecte
- **Fallback v1** : si le relay WebSocket est trop complexe, QR code → URL statique sur le VPS avec le token, relay implémenté en v2

---

## Récap provider-agnostic vs Claude-CLI-specific

| Feature | Agnostic | Partiel | CLI-only |
|---|---|---|---|
| `/help /clear /config /status /permissions /resume /vim /mcp /remote-control` | ✅ | | |
| `/compact /review` | ✅ | | |
| `/model` | ✅ dialog | ⚠️ erreur si claude-cli | |
| `/cost` | | ⚠️ parsing events | ✅ natif |
| `/memory` | | ⚠️ DB agent_memories | ✅ fichiers .claude/ |
| `/init` | | ⚠️ via LLM + fileTree | ✅ natif |
| Mode de session | ✅ injection prompt | | |
| Boutons Ask Cookia | ✅ | | |
| Gemini | ✅ OpenAI-compat | | |

---

## Fichiers de test à créer (résumé)

### Desktop (`apps/desktop/src/__tests__/unit/`)
- `sessionModes.test.ts`
- `contextInjection.test.ts`
- `providerConfig.test.ts`
- `cookiaContextStore.test.ts`
- `cookiaPromptBuilders.test.ts`
- `slashCommands.test.ts`
- `slashHandlers.test.ts`
- `remoteControl.test.ts`

### API (`apps/api/src/__tests__/unit/`)
- `llm.service.gemini.test.ts`
- `ai-session.injectMessage.test.ts`
- `relay.routes.test.ts`

### Rust (`apps/desktop/src-tauri/src/remote_control.rs`)
- Tests inline `#[cfg(test)]` dans le module

## Fichiers de production à créer (résumé)

### Desktop — pure logic (testables)
- `sessionModes.ts`
- `contextInjection.ts`
- `providerConfig.ts`
- `cookiaContextStore.ts`
- `cookiaPromptBuilders.ts`
- `slashCommands.ts`
- `slashHandlers.ts`
- `remoteControl.ts`
- `remote_control.rs` (Rust)

### Desktop — composants (non testés directement)
- `AiChatContent.tsx` (modifié)
- `AiComposer.tsx` (modifié)
- `AiTerminalTabs.tsx` (modifié)
- `RemoteControlModal.tsx` (nouveau)
- Boutons dans EmailDetail, RssView, SnippetView, TaskDetail, FluxSidebarContent

### API
- `relay.routes.ts`
- `llm.service.ts` (modifié — case gemini)
- `index.ts` (modifié — relay route)
