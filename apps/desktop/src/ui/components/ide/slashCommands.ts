export type SlashCommandLevel = "local" | "llm-assisted";

export interface SlashCommand {
  name: string;
  description: string;
  level: SlashCommandLevel;
  aliases?: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ─── Local commands (handled client-side, never sent to LLM) ───
  { name: "help",           description: "Afficher la liste des commandes disponibles",       level: "local" },
  { name: "clear",          description: "Vider l'historique de la session",                  level: "local" },
  { name: "model",          description: "Changer le modèle LLM de la session",               level: "local" },
  { name: "config",         description: "Ouvrir la configuration du provider actif",         level: "local" },
  { name: "permissions",    description: "Afficher les permissions du provider actif",        level: "local" },
  { name: "status",         description: "Afficher l'état de la session (tokens, coût…)",    level: "local" },
  { name: "mcp",            description: "Lister les serveurs MCP connectés",                 level: "local" },
  { name: "resume",         description: "Reprendre une session précédente",                  level: "local" },
  { name: "remote-control", description: "Générer un QR code pour contrôle mobile",          level: "local" },
  { name: "vim",            description: "Activer/désactiver le mode vim dans le composer",   level: "local" },

  // ─── LLM-assisted commands (sent to the active LLM) ───
  { name: "compact",  description: "Résumer la conversation pour libérer du contexte",        level: "llm-assisted" },
  { name: "cost",     description: "Estimer le coût en tokens de la session actuelle",        level: "llm-assisted" },
  { name: "memory",   description: "Afficher ou éditer la mémoire persistante de Cookia",    level: "llm-assisted" },
  { name: "init",     description: "Initialiser ou mettre à jour CLAUDE.md pour ce projet",  level: "llm-assisted" },
  { name: "review",   description: "Analyser le diff git courant et suggérer des améliorations", level: "llm-assisted" },
];

/**
 * Parse a slash command from user input.
 * Returns null if the text doesn't start with '/'.
 */
export function parseSlashCommand(text: string): { command: string; args: string[] } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const [command, ...args] = parts;
  return { command: command.toLowerCase(), args };
}

/**
 * Returns true if the text starts with '/' (slash autocomplete trigger).
 * A slash mid-text (e.g. in a URL like "hello /help") returns false.
 */
export function isSlashTrigger(text: string, _cursorPos: number): boolean {
  return text.startsWith("/");
}

/**
 * Filter commands by query prefix (matches against command name).
 */
export function filterCommands(query: string): SlashCommand[] {
  if (!query) return [...SLASH_COMMANDS];
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(q));
}
