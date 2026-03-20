import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

const API_BASE = "http://localhost:47300/api";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

const [conversations, setConversations] = createSignal<Conversation[]>([]);
const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
const [messages, setMessages] = createSignal<ChatMessage[]>([]);
const [sending, setSending] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);
const [streamingContent, setStreamingContent] = createSignal<string | null>(null);

/** Parse SSE events from a raw text buffer. Returns parsed events and remaining buffer. */
function parseSSE(buffer: string): { events: { event: string; data: string }[]; remaining: string } {
  const events: { event: string; data: string }[] = [];
  const blocks = buffer.split("\n\n");
  const remaining = blocks.pop() ?? "";

  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (data || event) events.push({ event, data });
  }

  return { events, remaining };
}

export function useChatStore() {
  async function fetchConversations() {
    try {
      const data = await api.get<Conversation[]>("/agent");
      setConversations(data);
    } catch (e: any) {
      console.error("Failed to fetch conversations:", e);
    }
  }

  async function createConversation() {
    try {
      const data = await api.post<Conversation>("/agent", {});
      setConversations((prev) => [data, ...prev]);
      await selectConversation(data.id);
    } catch (e: any) {
      console.error("Failed to create conversation:", e);
    }
  }

  async function selectConversation(id: string) {
    setActiveConversationId(id);
    setError(null);
    setStreamingContent(null);
    try {
      const data = await api.get<ChatMessage[]>(`/agent/${id}/messages`);
      setMessages(data);
    } catch (e: any) {
      console.error("Failed to fetch messages:", e);
    }
  }

  async function sendMessage(content: string) {
    const convId = activeConversationId();
    if (!convId || !content.trim()) return;

    setError(null);
    setSending(true);
    setStreamingContent("");

    // Optimistic: add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: "user",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${API_BASE}/agent/${convId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim() }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSE(buffer);
        buffer = remaining;

        for (const { event, data } of events) {
          if (event === "chunk") {
            accumulated += data;
            setStreamingContent(accumulated);
          } else if (event === "done") {
            // Final — refetch persisted messages
            setStreamingContent(null);
            const msgs = await api.get<ChatMessage[]>(`/agent/${convId}/messages`);
            setMessages(msgs);
          } else if (event === "error") {
            setError(data);
          }
          // "tool" events: silently process (agent is using tools)
        }
      }

      // If stream ended without "done" event, refetch anyway
      if (streamingContent() !== null) {
        setStreamingContent(null);
        const msgs = await api.get<ChatMessage[]>(`/agent/${convId}/messages`);
        setMessages(msgs);
      }

      await fetchConversations();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi du message");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setStreamingContent(null);
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(id: string) {
    try {
      await api.delete(`/agent/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId() === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (e: any) {
      console.error("Failed to delete conversation:", e);
    }
  }

  return {
    conversations,
    activeConversationId,
    messages,
    sending,
    error,
    streamingContent,
    fetchConversations,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
  };
}
