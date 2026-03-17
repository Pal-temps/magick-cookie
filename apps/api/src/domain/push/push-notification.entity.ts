export interface PushNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface CreatePushInput {
  type: string;
  title: string;
  body: string;
}
