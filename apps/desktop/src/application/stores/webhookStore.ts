import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface Webhook {
  id: string;
  name: string;
  secret: string;
  source: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  payload: string;
  receivedAt: string;
  readAt: string | null;
}

export interface CreateWebhookInput {
  name: string;
  source?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  source?: string;
  enabled?: boolean;
}

const [webhooks, setWebhooks] = createSignal<Webhook[]>([]);
const [webhookEvents, setWebhookEvents] = createSignal<WebhookEvent[]>([]);
const [selectedWebhookId, setSelectedWebhookId] = createSignal<string | null>(null);

export function useWebhookStore() {
  async function fetchWebhooks() {
    try {
      const data = await api.get<Webhook[]>("/webhooks");
      setWebhooks(data);
    } catch (e) {
      console.error("Failed to fetch webhooks:", e);
    }
  }

  async function createWebhook(input: CreateWebhookInput) {
    try {
      const webhook = await api.post<Webhook>("/webhooks", input);
      setWebhooks((prev) => [...prev, webhook]);
      return webhook;
    } catch (e) {
      console.error("Failed to create webhook:", e);
    }
  }

  async function updateWebhook(id: string, input: UpdateWebhookInput) {
    try {
      const webhook = await api.put<Webhook>(`/webhooks/${id}`, input);
      setWebhooks((prev) => prev.map((w) => (w.id === id ? webhook : w)));
      return webhook;
    } catch (e) {
      console.error("Failed to update webhook:", e);
    }
  }

  async function deleteWebhook(id: string) {
    try {
      await api.delete(`/webhooks/${id}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      if (selectedWebhookId() === id) {
        setSelectedWebhookId(null);
        setWebhookEvents([]);
      }
    } catch (e) {
      console.error("Failed to delete webhook:", e);
    }
  }

  async function fetchEvents(webhookId: string) {
    try {
      setSelectedWebhookId(webhookId);
      const data = await api.get<WebhookEvent[]>(`/webhooks/${webhookId}/events`);
      setWebhookEvents(data);
    } catch (e) {
      console.error("Failed to fetch webhook events:", e);
    }
  }

  async function markEventRead(eventId: string) {
    try {
      const event = await api.post<WebhookEvent>(`/webhooks/events/${eventId}/read`, {});
      setWebhookEvents((prev) => prev.map((e) => (e.id === eventId ? event : e)));
    } catch (e) {
      console.error("Failed to mark event read:", e);
    }
  }

  return {
    webhooks,
    webhookEvents,
    selectedWebhookId,
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    fetchEvents,
    markEventRead,
  };
}
