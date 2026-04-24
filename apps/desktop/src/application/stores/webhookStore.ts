import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { createCrudStore } from "./createCrudStore";

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

const crud = createCrudStore<Webhook, CreateWebhookInput, UpdateWebhookInput>({
  endpoint: "/webhooks",
  label: "webhooks",
});
const [webhookEvents, setWebhookEvents] = createSignal<WebhookEvent[]>([]);
const [selectedWebhookId, setSelectedWebhookId] = createSignal<string | null>(null);

export function useWebhookStore() {
  async function deleteWebhook(id: string) {
    await crud.delete(id);
    if (selectedWebhookId() === id) {
      setSelectedWebhookId(null);
      setWebhookEvents([]);
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
    webhooks: crud.items,
    webhookEvents,
    selectedWebhookId,
    fetchWebhooks: crud.fetchAll,
    createWebhook: crud.create,
    updateWebhook: crud.update,
    deleteWebhook,
    fetchEvents,
    markEventRead,
  };
}
