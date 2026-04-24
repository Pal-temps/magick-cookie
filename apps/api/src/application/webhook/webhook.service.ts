import { randomBytes, timingSafeEqual } from "crypto";
import type { WebhookRepository } from "../../domain/webhook/webhook.repository";
import type { Webhook, WebhookEvent, CreateWebhookInput, UpdateWebhookInput } from "../../domain/webhook/webhook.entity";

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export class WebhookService {
  constructor(private webhookRepo: WebhookRepository) {}

  async getAll(): Promise<Webhook[]> {
    return this.webhookRepo.findAll();
  }

  async getById(id: string): Promise<Webhook | null> {
    return this.webhookRepo.findById(id);
  }

  async create(input: CreateWebhookInput): Promise<Webhook> {
    const secret = randomBytes(32).toString("hex");
    return this.webhookRepo.create({ ...input, secret });
  }

  async update(id: string, input: UpdateWebhookInput): Promise<Webhook | null> {
    return this.webhookRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.webhookRepo.delete(id);
  }

  async receiveEvent(id: string, secret: string, payload: unknown): Promise<WebhookEvent | null> {
    const webhook = await this.webhookRepo.findById(id);
    if (!webhook || !webhook.enabled) return null;
    if (!secret || !secretsMatch(webhook.secret, secret)) return null;
    return this.webhookRepo.createEvent(id, JSON.stringify(payload));
  }

  async getEvents(webhookId: string, limit?: number): Promise<WebhookEvent[]> {
    return this.webhookRepo.findEvents(webhookId, limit);
  }

  async markEventRead(eventId: string): Promise<WebhookEvent | null> {
    return this.webhookRepo.markEventRead(eventId);
  }
}
