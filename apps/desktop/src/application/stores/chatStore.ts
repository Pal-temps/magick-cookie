import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

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

    // Optimistic: add user message to UI immediately
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: "user",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const assistantMsg = await api.post<ChatMessage>(`/agent/${convId}/messages`, { message: content.trim() });
      // Replace temp user message and add assistant message by re-fetching
      const data = await api.get<ChatMessage[]>(`/agent/${convId}/messages`);
      setMessages(data);
      // Refresh conversations list (title may have been auto-generated)
      await fetchConversations();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi du message");
      // Remove optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
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
    fetchConversations,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
  };
}
