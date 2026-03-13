export interface NotificationPort {
  requestPermission(): Promise<boolean>;
  send(title: string, body: string): Promise<void>;
}
