import { eq, isNull, desc, lt } from "drizzle-orm";
import type { Database } from "../database/client";
import { pushNotifications } from "../database/schema";
import type { PushNotificationRepository } from "../../domain/push/push-notification.repository";
import type { PushNotification, CreatePushInput } from "../../domain/push/push-notification.entity";

export class DrizzlePushNotificationRepository implements PushNotificationRepository {
  constructor(private db: Database) {}

  async findPending(): Promise<PushNotification[]> {
    const rows = await this.db.select().from(pushNotifications)
      .where(isNull(pushNotifications.readAt))
      .orderBy(desc(pushNotifications.createdAt));
    return rows.map(this.toDomain);
  }

  async findAll(limit = 50): Promise<PushNotification[]> {
    const rows = await this.db.select().from(pushNotifications)
      .orderBy(desc(pushNotifications.createdAt))
      .limit(limit);
    return rows.map(this.toDomain);
  }

  async create(input: CreatePushInput): Promise<PushNotification> {
    const rows = await this.db.insert(pushNotifications).values({
      type: input.type,
      title: input.title,
      body: input.body,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async markAsRead(id: string): Promise<void> {
    await this.db.update(pushNotifications)
      .set({ readAt: new Date() })
      .where(eq(pushNotifications.id, id));
  }

  async markAllAsRead(): Promise<void> {
    await this.db.update(pushNotifications)
      .set({ readAt: new Date() })
      .where(isNull(pushNotifications.readAt));
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const rows = await this.db.delete(pushNotifications)
      .where(lt(pushNotifications.createdAt, cutoff))
      .returning({ id: pushNotifications.id });
    return rows.length;
  }

  private toDomain(row: typeof pushNotifications.$inferSelect): PushNotification {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      readAt: row.readAt,
    };
  }
}
