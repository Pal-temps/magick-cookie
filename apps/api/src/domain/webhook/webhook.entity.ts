export interface Webhook {
  id: string;
  name: string;
  secret: string;
  source: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  payload: string;
  receivedAt: Date;
  readAt: Date | null;
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
