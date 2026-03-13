import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let permissionGranted: boolean | null = null;

export async function initNotifications(): Promise<boolean> {
  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }
  return permissionGranted;
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (permissionGranted === null) {
      await initNotifications();
    }
    if (permissionGranted) {
      sendNotification({ title, body });
    }
  } catch (e) {
    console.error("Notification failed:", e);
  }
}
