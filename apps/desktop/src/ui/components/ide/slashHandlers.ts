import type { SlashCommand } from "./slashCommands";
import type { AiMessage } from "../../../application/stores/aiSessionStore";

export const MAX_COMPACT_MESSAGES = 20;

/**
 * Build a "compact" prompt that summarizes recent conversation history.
 * Returns null if there are no assistant messages to summarize.
 */
export function buildCompactPrompt(messages: AiMessage[]): string | null {
  const relevant = messages.filter((m) => m.type === "assistant" || m.type === "user");
  if (!relevant.some((m) => m.type === "assistant")) return null;

  const recent = relevant.slice(-MAX_COMPACT_MESSAGES);
  const history = recent
    .map((m) => `[${m.type === "user" ? "Utilisateur" : "Assistant"}]: ${m.content}`)
    .join("\n\n");

  return `Résume la conversation suivante en conservant les décisions et contexte clés :\n\n${history}`;
}

/**
 * Build the help message listing all available slash commands.
 */
export function buildHelpMessage(commands: SlashCommand[]): string {
  const lines = commands.map((cmd) => {
    const level = cmd.level === "local" ? "local" : "llm-assisted";
    return `/${cmd.name} — ${cmd.description} [${level}]`;
  });
  return `**Commandes disponibles :**\n\n${lines.join("\n")}`;
}

/**
 * Build a code review prompt from a git diff string.
 * Returns null if the diff is empty.
 */
export function buildReviewPrompt(diff: string): string | null {
  if (!diff.trim()) return null;
  return `Analyse ce diff git et suggère des améliorations (lisibilité, sécurité, performance) :\n\n\`\`\`diff\n${diff}\n\`\`\``;
}

/** Returns true if the provider is Claude CLI (handles slash commands natively). */
export function isClaudeCliProvider(provider: string): boolean {
  return provider === "claude-cli";
}

/** Create a system message to inject into the session feed (e.g. for /help output). */
export function makeSystemMessage(content: string): AiMessage {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    seq: -1,
    type: "system",
    content,
    timestamp: Date.now(),
  };
}
