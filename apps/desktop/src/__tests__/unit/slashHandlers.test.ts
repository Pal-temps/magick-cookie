import { describe, it, expect } from "bun:test";
import {
  buildCompactPrompt,
  buildHelpMessage,
  buildReviewPrompt,
  isClaudeCliProvider,
  makeSystemMessage,
  MAX_COMPACT_MESSAGES,
} from "../../ui/components/ide/slashHandlers";
import { SLASH_COMMANDS } from "../../ui/components/ide/slashCommands";
import type { AiMessage } from "../../application/stores/aiSessionStore";

function makeMsg(type: AiMessage["type"], content: string, id = Math.random().toString()): AiMessage {
  return { id, seq: 0, type, content, timestamp: Date.now() };
}

describe("buildCompactPrompt", () => {
  it("retourne null si aucun message dans l'historique", () => {
    expect(buildCompactPrompt([])).toBeNull();
  });

  it("retourne null si seulement des messages user (pas d'assistant)", () => {
    const messages = [makeMsg("user", "bonjour")];
    expect(buildCompactPrompt(messages)).toBeNull();
  });

  it("inclut les messages assistant dans le prompt", () => {
    const messages = [
      makeMsg("user", "bonjour"),
      makeMsg("assistant", "salut, comment puis-je t'aider ?"),
    ];
    const prompt = buildCompactPrompt(messages);
    expect(prompt).not.toBeNull();
    expect(prompt!).toContain("salut, comment puis-je t'aider ?");
  });

  it("inclut un verbe de résumé dans le prompt", () => {
    const messages = [makeMsg("assistant", "voici la réponse")];
    const prompt = buildCompactPrompt(messages);
    expect(prompt!.toLowerCase()).toMatch(/résum|résume|summarize|résumé/);
  });

  it("ne dépasse pas MAX_COMPACT_MESSAGES messages", () => {
    const messages: AiMessage[] = [];
    for (let i = 0; i < MAX_COMPACT_MESSAGES + 10; i++) {
      messages.push(makeMsg("assistant", `message ${i}`));
    }
    const prompt = buildCompactPrompt(messages);
    // The prompt should truncate — last MAX_COMPACT_MESSAGES messages at most
    expect(prompt).not.toBeNull();
    // Vérification indirecte: le message 0 ne doit pas apparaître (trop ancien)
    expect(prompt).not.toContain("message 0");
  });
});

describe("buildHelpMessage", () => {
  it("liste toutes les commandes disponibles", () => {
    const msg = buildHelpMessage(SLASH_COMMANDS);
    expect(msg).toContain("/help");
    expect(msg).toContain("/compact");
    expect(msg).toContain("/clear");
  });

  it("indique le niveau pour chaque commande", () => {
    const msg = buildHelpMessage(SLASH_COMMANDS);
    expect(msg).toMatch(/local|llm-assisted/i);
  });

  it("inclut la description de chaque commande", () => {
    const cmds = SLASH_COMMANDS.slice(0, 3);
    const msg = buildHelpMessage(cmds);
    for (const cmd of cmds) {
      expect(msg).toContain(cmd.description);
    }
  });
});

describe("buildReviewPrompt", () => {
  it("inclut le diff git dans le prompt", () => {
    const diff = "diff --git a/foo.ts b/foo.ts\n+const x = 1";
    const prompt = buildReviewPrompt(diff);
    expect(prompt).not.toBeNull();
    expect(prompt!).toContain("diff --git");
    expect(prompt!).toContain("+const x = 1");
  });

  it("retourne null si diff vide", () => {
    expect(buildReviewPrompt("")).toBeNull();
  });

  it("retourne null si diff est juste des espaces", () => {
    expect(buildReviewPrompt("   \n  ")).toBeNull();
  });
});

describe("isClaudeCliProvider", () => {
  it("retourne true pour 'claude-cli'", () => {
    expect(isClaudeCliProvider("claude-cli")).toBe(true);
  });

  it("retourne false pour 'anthropic-api'", () => {
    expect(isClaudeCliProvider("anthropic-api")).toBe(false);
  });

  it("retourne false pour 'gemini-api'", () => {
    expect(isClaudeCliProvider("gemini-api")).toBe(false);
  });
});

describe("makeSystemMessage", () => {
  it("crée un message avec type 'system'", () => {
    const msg = makeSystemMessage("Liste des commandes : /help");
    expect(msg.type).toBe("system");
  });

  it("contient le content fourni", () => {
    const msg = makeSystemMessage("message test");
    expect(msg.content).toContain("message test");
  });

  it("génère un id unique pour chaque appel", () => {
    const a = makeSystemMessage("a");
    const b = makeSystemMessage("b");
    expect(a.id).not.toBe(b.id);
  });

  it("a un timestamp récent", () => {
    const before = Date.now();
    const msg = makeSystemMessage("test");
    const after = Date.now();
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });
});
