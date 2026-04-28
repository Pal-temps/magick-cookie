// Session modes — Phase 6.1 of the AI integration plan.
//
// A session mode trims the tool surface and overrides the system prompt to focus
// the LLM on a specific task. Without this, the agent's system prompt would carry
// every single tool description (~50 tools after P5) which (a) eats context budget,
// (b) lets the LLM reach for tools that don't make sense for the user's intent.
//
// Modes:
//   - general    : everything (the default; matches pre-P6 behavior)
//   - brief      : read-only — building a daily/weekly recap
//   - triage     : inbox-style mutations (mark read, star, archive, flux) — no infra
//   - ide-dev    : code workflow (git remotes, GitHub/GitLab actions, SSH, deploy)
//   - meeting-prep : looking up context for an upcoming event (contacts, notes, recent email)
//
// Modes do NOT relax permission tiers — a mode whitelist still has to pass the
// dispatcher's auto/user-confirm/admin gate. They only narrow the surface.

import type { AgentTool } from "./tool-registry";

export type SessionMode = "general" | "brief" | "triage" | "ide-dev" | "meeting-prep";

export const ALL_SESSION_MODES: SessionMode[] = ["general", "brief", "triage", "ide-dev", "meeting-prep"];

interface ModeDefinition {
  /** Sentinel `"all"` means no filtering — every tool registered is available. */
  toolNames: readonly string[] | "all";
  /** Short hint appended to the system prompt to steer the LLM. */
  promptHint: string;
}

const READ_ONLY_DATA_TOOLS = [
  // Analytics
  "get_productivity_overview",
  "get_streak",
  "get_weekly_review",
  "get_productivity_patterns",
  "get_time_by_project",
  "get_today_stats",
  // Brief
  "generate_brief",
  // Calendar (read)
  "calendar_list",
  "calendar_find_conflict",
  // Email (read)
  "get_unread_email_count",
  "classify_email",
  // RSS (read)
  "rss_generate_digest",
  // Notes (read)
  "notes_list",
  "notes_read",
  // Tasks / flux (read)
  "get_all_tasks",
  "get_priority_items",
  "get_flux_by_status",
  // Memory
  "get_memories",
  // Skills
  "skill_list",
  "skill_get",
] as const;

const TRIAGE_TOOLS = [
  // Inbox mutations
  "email_mark_read",
  "email_star",
  "email_move",
  "classify_email",
  "get_unread_email_count",
  // RSS mutations
  "rss_mark_read",
  "rss_star",
  "rss_mark_all_read",
  // Flux assignment
  "set_flux",
  "get_priority_items",
  "get_flux_by_status",
  // Notes capture
  "notes_create",
  "notes_append",
  // Memory
  "save_memory",
  "get_memories",
] as const;

const IDE_DEV_TOOLS = [
  // GitHub
  "github_list_repos",
  "github_create_issue",
  "github_close_issue",
  "github_add_comment",
  "github_trigger_workflow",
  "github_list_prs",
  "github_review_pr",
  // GitLab
  "gitlab_list_projects",
  "gitlab_create_issue",
  "gitlab_close_issue",
  "gitlab_add_comment",
  "gitlab_trigger_pipeline",
  "gitlab_list_mrs",
  "gitlab_review_mr",
  // Git remote (vps-bare etc.)
  "git_remote_providers",
  "git_remote_list",
  "git_remote_create",
  "git_remote_delete",
  // SSH / deploy / DNS (gated by user-confirm/admin still)
  "server_list",
  "ssh_exec",
  "ssh_upload",
  "caddy_add_site",
  "caddy_list_sites",
  "dns_list_zones",
  "dns_list_records",
  "dns_create_record",
  "dns_delete_record",
  // Skills (devs orchestrate via skills)
  "skill_list",
  "skill_get",
  "skill_prompt",
  // Notes for design/log
  "notes_list",
  "notes_read",
  "notes_create",
  "notes_edit",
  "notes_append",
] as const;

const MEETING_PREP_TOOLS = [
  // Calendar
  "calendar_list",
  "calendar_find_conflict",
  // Contacts
  "contact_list",
  "contact_find_by_email",
  // Recent email + sender lookup
  "get_unread_email_count",
  // Notes / context
  "notes_list",
  "notes_read",
  // Memory
  "get_memories",
] as const;

const MODES: Record<SessionMode, ModeDefinition> = {
  general: {
    toolNames: "all",
    promptHint: "Mode general : tu as acces a tous les outils. Choisis celui qui correspond le mieux a la question.",
  },
  brief: {
    toolNames: READ_ONLY_DATA_TOOLS,
    promptHint: "Mode brief : tu rediges un resume / bilan. Utilise UNIQUEMENT des outils en lecture — n'execute aucune action mutative (pas de creation, pas d'envoi, pas de modification).",
  },
  triage: {
    toolNames: TRIAGE_TOOLS,
    promptHint: "Mode triage : tu tries la boite de reception. Tu peux marquer comme lu, etoiler, archiver, classer dans le flux, et capturer des notes rapides. Pas d'actions infra ni de devops.",
  },
  "ide-dev": {
    toolNames: IDE_DEV_TOOLS,
    promptHint: "Mode developpement : tu accompagnes du travail sur du code (issues, PRs/MRs, repos, deploiement). Les actions destructives ou irreversibles passent par confirmation utilisateur.",
  },
  "meeting-prep": {
    toolNames: MEETING_PREP_TOOLS,
    promptHint: "Mode preparation de reunion : tu rassembles le contexte pour un evenement a venir. Pas d'envoi, pas de modification — seulement de la lecture.",
  },
};

/**
 * Filter the registered tool set to only the ones available in this mode.
 * Returns the input array unchanged when mode === "general".
 */
export function selectToolsForMode(mode: SessionMode, tools: AgentTool[]): AgentTool[] {
  const def = MODES[mode];
  if (def.toolNames === "all") return tools;
  const allowed = new Set(def.toolNames);
  return tools.filter((t) => allowed.has(t.name));
}

/** Short text appended to the system prompt to bias the LLM toward the mode's intent. */
export function getModePromptHint(mode: SessionMode): string {
  return MODES[mode].promptHint;
}

/**
 * Discoverability helper: returns the configured tool whitelist for a mode (or
 * `null` for `general`, which has no whitelist). Used by tests + future Settings UI.
 */
export function getModeTools(mode: SessionMode): readonly string[] | null {
  const def = MODES[mode];
  return def.toolNames === "all" ? null : def.toolNames;
}
