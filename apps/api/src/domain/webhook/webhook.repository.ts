import type { Webhook, WebhookEvent, CreateWebhookInput, UpdateWebhookInput } from "./webhook.entity";

export interface WebhookRepository {
  findAll(): Promise<Webhook[]>;
  findById(id: string): Promise<Webhook | null>;
  create(input: CreateWebhookInput & { secret: string }): Promise<Webhook>;
  update(id: string, input: UpdateWebhookInput): Promise<Webhook | null>;
  delete(id: string): Promise<boolean>;
  findEvents(webhookId: string, limit?: number): Promise<WebhookEvent[]>;
  createEvent(webhookId: string, payload: string): Promise<WebhookEvent>;
  markEventRead(eventId: string): Promise<WebhookEvent | null>;
}
