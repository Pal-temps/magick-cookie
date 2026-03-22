import { createSignal, batch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ─── Types (mirror Rust ai/types.rs) ───

export interface AdapterCapabilities {
  supports_tools: boolean;
  supports_permissions: boolean;
  supports_streaming: boolean;
  supports_images: boolean;
  supports_file_access: boolean;
  supports_terminal: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  capabilities: AdapterCapabilities;
}

export interface SessionConfig {
  provider: string;
  model: string;
  cwd: string;
  api_key?: string | null;
  base_url?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
}

export type StreamPhase = "thinking" | "text";
export type SessionPhase = "connecting" | "ready" | "terminated";

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  toolInput: unknown;
  description: string;
}

export interface AiMessage {
  id: string;
  seq: number;
  type: "user" | "assistant" | "system" | "tool_use" | "tool_result" | "permission_request" | "error";
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  toolIsError?: boolean;
  permissionRequest?: PermissionRequest;
  isStreaming?: boolean;
  streamPhase?: StreamPhase;
  timestamp: number;
}

export interface AiSession {
  id: string;
  provider: string;
  capabilities: AdapterCapabilities;
  phase: SessionPhase;
  model: string;
  messages: AiMessage[];
  pendingPermissions: Map<string, PermissionRequest>;
  isStreaming: boolean;
  streamingContent: string;
  streamPhase: StreamPhase;
}

// ─── Adapter event payload (from Tauri) ───

interface AiEventPayload {
  session_id: string;
  seq: number;
  event: AdapterEvent;
}

type AdapterEvent =
  | { type: "session_ready"; model: string; tools: string[] }
  | { type: "stream_token"; text: string; phase: StreamPhase }
  | { type: "assistant_message"; content: string; model?: string | null }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error: boolean }
  | { type: "permission_request"; request_id: string; tool_name: string; tool_input: unknown; description: string }
  | { type: "permission_cancelled"; request_id: string }
  | { type: "tool_progress"; tool_use_id: string; tool_name: string; elapsed_seconds: number }
  | { type: "turn_complete"; stop_reason?: string | null }
  | { type: "error"; message: string }
  | { type: "session_terminated"; reason: string };

// ─── State ───

const [sessions, setSessions] = createSignal<Map<string, AiSession>>(new Map());
const [activeSessionId, setActiveSessionId] = createSignal<string | null>(null);
const [providers, setProviders] = createSignal<ProviderInfo[]>([]);

let listenerInitialized = false;
let msgCounter = 0;

// ─── Helpers ───

function getSession(id: string): AiSession | undefined {
  return sessions().get(id);
}

function updateSession(id: string, updater: (session: AiSession) => AiSession) {
  setSessions((prev) => {
    const session = prev.get(id);
    if (!session) return prev;
    const next = new Map(prev);
    next.set(id, updater({ ...session }));
    return next;
  });
}

function addMessage(sessionId: string, msg: AiMessage) {
  updateSession(sessionId, (s) => ({
    ...s,
    messages: [...s.messages, msg],
  }));
}

function nextMsgId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

// ─── Event handler ───

function handleAiEvent(payload: AiEventPayload) {
  const { session_id, seq, event } = payload;
  const session = getSession(session_id);
  if (!session) return;

  switch (event.type) {
    case "session_ready":
      updateSession(session_id, (s) => ({
        ...s,
        phase: "ready",
        model: event.model,
      }));
      addMessage(session_id, {
        id: nextMsgId(), seq, type: "system",
        content: `Connecte a ${session.provider} (${event.model})`,
        timestamp: Date.now(),
      });
      break;

    case "stream_token":
      updateSession(session_id, (s) => ({
        ...s,
        isStreaming: true,
        streamingContent: s.streamingContent + event.text,
        streamPhase: event.phase,
      }));
      break;

    case "assistant_message":
      batch(() => {
        // Finalize streaming content into a message
        const s = getSession(session_id);
        const content = event.content || s?.streamingContent || "";
        addMessage(session_id, {
          id: nextMsgId(), seq, type: "assistant",
          content,
          timestamp: Date.now(),
        });
        updateSession(session_id, (s) => ({
          ...s,
          isStreaming: false,
          streamingContent: "",
          streamPhase: "text",
        }));
      });
      break;

    case "tool_use":
      addMessage(session_id, {
        id: nextMsgId(), seq, type: "tool_use",
        content: "",
        toolName: event.name,
        toolInput: event.input,
        timestamp: Date.now(),
      });
      break;

    case "tool_result":
      addMessage(session_id, {
        id: nextMsgId(), seq, type: "tool_result",
        content: "",
        toolResult: event.content,
        toolIsError: event.is_error,
        timestamp: Date.now(),
      });
      break;

    case "permission_request":
      updateSession(session_id, (s) => {
        const perms = new Map(s.pendingPermissions);
        perms.set(event.request_id, {
          requestId: event.request_id,
          toolName: event.tool_name,
          toolInput: event.tool_input,
          description: event.description,
        });
        return { ...s, pendingPermissions: perms };
      });
      addMessage(session_id, {
        id: nextMsgId(), seq, type: "permission_request",
        content: event.description,
        permissionRequest: {
          requestId: event.request_id,
          toolName: event.tool_name,
          toolInput: event.tool_input,
          description: event.description,
        },
        timestamp: Date.now(),
      });
      break;

    case "permission_cancelled":
      updateSession(session_id, (s) => {
        const perms = new Map(s.pendingPermissions);
        perms.delete(event.request_id);
        return { ...s, pendingPermissions: perms };
      });
      break;

    case "tool_progress":
      // Could update a progress indicator on the latest tool_use message
      break;

    case "turn_complete":
      batch(() => {
        // If there's accumulated streaming content not yet finalized
        const s = getSession(session_id);
        if (s && s.streamingContent) {
          addMessage(session_id, {
            id: nextMsgId(), seq, type: "assistant",
            content: s.streamingContent,
            timestamp: Date.now(),
          });
        }
        updateSession(session_id, (s) => ({
          ...s,
          isStreaming: false,
          streamingContent: "",
          streamPhase: "text",
        }));
      });
      break;

    case "error":
      addMessage(session_id, {
        id: nextMsgId(), seq, type: "error",
        content: event.message,
        timestamp: Date.now(),
      });
      break;

    case "session_terminated":
      updateSession(session_id, (s) => ({
        ...s,
        phase: "terminated",
        isStreaming: false,
      }));
      addMessage(session_id, {
        id: nextMsgId(), seq, type: "system",
        content: `Session terminee: ${event.reason}`,
        timestamp: Date.now(),
      });
      break;
  }
}

// ─── Store ───

export function useAiSessionStore() {

  // Initialize listener once
  if (!listenerInitialized) {
    listenerInitialized = true;
    listen<AiEventPayload>("ai-event", (event) => {
      handleAiEvent(event.payload);
    });
  }

  // ─── Computed ───

  function activeSession(): AiSession | undefined {
    const id = activeSessionId();
    return id ? getSession(id) : undefined;
  }

  // ─── Actions ───

  async function fetchProviders() {
    const list = await invoke<ProviderInfo[]>("ai_list_providers");
    setProviders(list);
    return list;
  }

  async function startSession(config: SessionConfig): Promise<string> {
    const capabilities = await invoke<AdapterCapabilities>("ai_get_capabilities", { provider: config.provider });

    const sessionId = await invoke<string>("ai_start_session", {
      provider: config.provider,
      config,
    });

    const session: AiSession = {
      id: sessionId,
      provider: config.provider,
      capabilities,
      phase: "connecting",
      model: config.model,
      messages: [],
      pendingPermissions: new Map(),
      isStreaming: false,
      streamingContent: "",
      streamPhase: "text",
    };

    setSessions((prev) => {
      const next = new Map(prev);
      next.set(sessionId, session);
      return next;
    });
    setActiveSessionId(sessionId);

    return sessionId;
  }

  async function sendMessage(content: string, images?: { media_type: string; data: string }[]) {
    const id = activeSessionId();
    if (!id) return;

    // Add user message to local state immediately
    addMessage(id, {
      id: nextMsgId(), seq: 0, type: "user",
      content,
      timestamp: Date.now(),
    });

    // Clear previous streaming state
    updateSession(id, (s) => ({
      ...s,
      isStreaming: true,
      streamingContent: "",
      streamPhase: "text",
    }));

    await invoke("ai_send_message", {
      sessionId: id,
      content,
      images: images ?? null,
    });
  }

  async function respondPermission(requestId: string, allowed: boolean) {
    const id = activeSessionId();
    if (!id) return;

    await invoke("ai_respond_permission", {
      sessionId: id,
      requestId,
      allowed,
    });

    // Remove from pending
    updateSession(id, (s) => {
      const perms = new Map(s.pendingPermissions);
      perms.delete(requestId);
      return { ...s, pendingPermissions: perms };
    });
  }

  async function interruptSession() {
    const id = activeSessionId();
    if (!id) return;
    await invoke("ai_interrupt", { sessionId: id });
  }

  async function stopSession(sessionId?: string) {
    const id = sessionId ?? activeSessionId();
    if (!id) return;

    await invoke("ai_stop_session", { sessionId: id });

    setSessions((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    if (activeSessionId() === id) {
      setActiveSessionId(null);
    }
  }

  function switchSession(sessionId: string) {
    setActiveSessionId(sessionId);
  }

  function clearMessages(sessionId?: string) {
    const id = sessionId ?? activeSessionId();
    if (!id) return;
    updateSession(id, (s) => ({ ...s, messages: [] }));
  }

  return {
    // State
    sessions,
    activeSessionId,
    activeSession,
    providers,

    // Actions
    fetchProviders,
    startSession,
    sendMessage,
    respondPermission,
    interruptSession,
    stopSession,
    switchSession,
    clearMessages,
  };
}
