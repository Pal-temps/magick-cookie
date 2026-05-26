/**
 * AI Registry — Central catalog of all AI features in the app.
 *
 * Purpose:
 *  - Single source of truth for audit, monitoring, and maintenance.
 *  - Used by verify-v1 script to know which endpoints/commands to test.
 *  - Flags direct component calls (directInComponent) that should be
 *    migrated to a store/service before v1.
 *
 * Status legend:
 *  - store ✓        : call is already centralized in a store/service
 *  - ⚠️ direct      : call lives in a UI component — should be moved
 */

export type AiFeatureType = "llm-api" | "tauri-invoke" | "sse-stream";

export interface AiFeature {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Human-readable label */
  label: string;
  /** Tab / view where this feature is surfaced */
  tab: string;
  /** Kind of AI call */
  type: AiFeatureType;
  /**
   * API path (for llm-api) or Tauri command name (for tauri-invoke)
   * or Tauri event name (for sse-stream).
   */
  endpoint?: string;
  /** Store or service that owns the call (if centralized) */
  store?: string;
  /**
   * Component that calls the AI directly instead of going through a store.
   * Non-empty = needs refactoring.
   */
  directInComponent?: string;
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const AI_REGISTRY: AiFeature[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id: "dashboard-forecast",
    label: "Prévision analytique quotidienne",
    tab: "dashboard",
    type: "llm-api",
    endpoint: "POST /analytics/forecast",
    store: "analyticsStore",
  },

  // ── Calendar ───────────────────────────────────────────────────────────────
  {
    id: "calendar-generate-events",
    label: "Génération d'événements depuis texte libre",
    tab: "calendar",
    type: "llm-api",
    endpoint: "POST /llm/generate-events",
    store: "calendarStore",
  },

  // ── Flux ───────────────────────────────────────────────────────────────────
  {
    id: "flux-suggest",
    label: "Suggestion de catégorie pour article Flux",
    tab: "flux",
    type: "llm-api",
    endpoint: "POST /flux/suggest",
    store: "fluxStore",
  },

  // ── Tools / Tasks ──────────────────────────────────────────────────────────
  {
    id: "task-generate-code",
    label: "Génération de code depuis une tâche",
    tab: "tools",
    type: "llm-api",
    endpoint: "POST /llm/generate-code",
    store: "taskStore",
    // Was previously called directly in the component — now centralized via taskStore.generateCode()
  },
  {
    id: "changelog-generate",
    label: "Génération de changelog depuis les commits",
    tab: "tools",
    type: "llm-api",
    endpoint: "POST /changelog/generate",
    store: "changelogService",
    // Was previously called directly in the component — now centralized via changelogService.generateChangelog()
  },

  // ── Cookia / IDE ───────────────────────────────────────────────────────────
  {
    id: "ide-session-start",
    label: "Démarrage d'une session IA locale",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_start_session",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-send",
    label: "Envoi d'un message à la session IA",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_send_message",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-permission",
    label: "Réponse à une demande de permission outil",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_respond_permission",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-interrupt",
    label: "Interruption de la génération en cours",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_interrupt",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-stop",
    label: "Arrêt d'une session IA",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_stop_session",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-rename",
    label: "Renommage d'une session IA",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_update_session_label",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-list-past",
    label: "Liste des sessions passées",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_list_past_sessions",
    store: "aiSessionStore",
  },
  {
    id: "ide-session-read-past",
    label: "Lecture d'une session passée",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_read_past_session",
    store: "aiSessionStore",
  },
  {
    id: "ide-remote-start",
    label: "Démarrage d'une session mobile distante",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_start_remote_session",
    store: "aiSessionStore",
    // Was previously called directly in RemoteControlModal — now centralized via aiSessionStore.startRemoteSession()
  },
  {
    id: "ide-remote-stop",
    label: "Arrêt d'une session mobile distante",
    tab: "cookia",
    type: "tauri-invoke",
    endpoint: "ai_stop_remote_session",
    store: "aiSessionStore",
    // Was previously called directly in RemoteControlModal — now centralized via aiSessionStore.stopRemoteSession()
  },
  {
    id: "ide-stream",
    label: "Flux SSE d'événements IA (tokens, outils, permissions…)",
    tab: "cookia",
    type: "sse-stream",
    endpoint: "ai-event",
    store: "aiSessionStore",
  },

  // ── Agent chat (Cookia + Flux) ─────────────────────────────────────────────
  {
    id: "agent-chat",
    label: "Chat avec un agent (messages streamés)",
    tab: "cookia/flux",
    type: "llm-api",
    endpoint: "POST /agent/:id/messages/stream",
    store: "agentStore",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All features that still have a direct component call (should be migrated). */
export const UNCENTRALIZED_FEATURES = AI_REGISTRY.filter(
  (f) => f.directInComponent,
);

/** All LLM API endpoints (used by verify-v1 script). */
export const LLM_ENDPOINTS = AI_REGISTRY.filter(
  (f) => f.type === "llm-api",
).map((f) => f.endpoint!);

/** All Tauri commands invoked by AI features (used by verify-v1 for documentation). */
export const TAURI_AI_COMMANDS = AI_REGISTRY.filter(
  (f) => f.type === "tauri-invoke",
).map((f) => f.endpoint!);
