import type { PushNotification, CreatePushInput } from "./push-notification.entity";

export interface PushNotificationRepository {
  findPending(): Promise<PushNotification[]>;
  findAll(limit?: number): Promise<PushNotification[]>;
  create(input: CreatePushInput): Promise<PushNotification>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  deleteOlderThan(days: number): Promise<number>;
}
