import { eq, desc } from "drizzle-orm";
import type { Database } from "../database/client";
import { webhooks, webhookEvents } from "../database/schema";
import type { WebhookRepository } from "../../domain/webhook/webhook.repository";
import type { Webhook, WebhookEvent, CreateWebhookInput, UpdateWebhookInput } from "../../domain/webhook/webhook.entity";

export class DrizzleWebhookRepository implements WebhookRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Webhook[]> {
    const rows = await this.db.select().from(webhooks).orderBy(webhooks.name);
    return rows.map(this.toWebhookDomain);
  }

  async findById(id: string): Promise<Webhook | null> {
    const rows = await this.db.select().from(webhooks).where(eq(webhooks.id, id));
    return rows[0] ? this.toWebhookDomain(rows[0]) : null;
  }

  async create(input: CreateWebhookInput & { secret: string }): Promise<Webhook> {
    const rows = await this.db.insert(webhooks).values({
      name: input.name,
      secret: input.secret,
      source: input.source ?? null,
    }).returning();
    return this.toWebhookDomain(rows[0]);
  }

  async update(id: string, input: UpdateWebhookInput): Promise<Webhook | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.source !== undefined) values.source = input.source;
    if (input.enabled !== undefined) values.enabled = input.enabled;

    const rows = await this.db.update(webhooks).set(values).where(eq(webhooks.id, id)).returning();
    return rows[0] ? this.toWebhookDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(webhooks).where(eq(webhooks.id, id)).returning({ id: webhooks.id });
    return rows.length > 0;
  }

  async findEvents(webhookId: string, limit = 50): Promise<WebhookEvent[]> {
    const rows = await this.db.select().from(webhookEvents)
      .where(eq(webhookEvents.webhookId, webhookId))
      .orderBy(desc(webhookEvents.receivedAt))
      .limit(limit);
    return rows.map(this.toEventDomain);
  }

  async createEvent(webhookId: string, payload: string): Promise<WebhookEvent> {
    const rows = await this.db.insert(webhookEvents).values({
      webhookId,
      payload,
    }).returning();
    return this.toEventDomain(rows[0]);
  }

  async markEventRead(eventId: string): Promise<WebhookEvent | null> {
    const rows = await this.db.update(webhookEvents)
      .set({ readAt: new Date() })
      .where(eq(webhookEvents.id, eventId))
      .returning();
    return rows[0] ? this.toEventDomain(rows[0]) : null;
  }

  private toWebhookDomain(row: typeof webhooks.$inferSelect): Webhook {
    return {
      id: row.id,
      name: row.name,
      secret: row.secret,
      source: row.source,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toEventDomain(row: typeof webhookEvents.$inferSelect): WebhookEvent {
    return {
      id: row.id,
      webhookId: row.webhookId,
      payload: row.payload,
      receivedAt: row.receivedAt,
      readAt: row.readAt,
    };
  }
}
