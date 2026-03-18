import notificationSound from "../../assets/sounds/cookie-notification-v3.mp3";
import focusEndSound from "../../assets/sounds/put-that-cookie-down.mp3";
import alarmSound from "../../assets/sounds/cookie-boogie.mp3";

const sounds = {
  notification: notificationSound,
  focusEnd: focusEndSound,
  alarm: alarmSound,
} as const;

export type SoundName = keyof typeof sounds;

export function playSound(name: SoundName, volume: number = 0.7): void {
  try {
    const audio = new Audio(sounds[name]);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {
      // Autoplay blocked — ignore silently
    });
  } catch {
    // Audio not supported — ignore
  }
}
