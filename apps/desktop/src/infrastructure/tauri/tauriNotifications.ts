import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { NotificationPort } from "../../domain/ports/NotificationPort";

export class TauriNotificationAdapter implements NotificationPort {
  async requestPermission(): Promise<boolean> {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  }

  async send(title: string, body: string): Promise<void> {
    const granted = await isPermissionGranted();
    if (granted) {
      sendNotification({ title, body });
    }
  }
}
