import notificationSound from "../../assets/sounds/cookie-notification-v3.mp3";
import focusEndSound from "../../assets/sounds/put-that-cookie-down.mp3";
import alarmSound from "../../assets/sounds/cookie-boogie.mp3";

const sounds = {
  notification: notificationSound,
  focusEnd: focusEndSound,
  alarm: alarmSound,
} as const;

export type SoundName = keyof typeof sounds;

let loopingAudio: HTMLAudioElement | null = null;

export function playSound(name: SoundName, volume: number = 0.7): void {
  try {
    const audio = new Audio(sounds[name]);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {});
  } catch {}
}

export function playSoundLoop(name: SoundName, volume: number = 0.7): void {
  stopSoundLoop();
  try {
    loopingAudio = new Audio(sounds[name]);
    loopingAudio.volume = Math.max(0, Math.min(1, volume));
    loopingAudio.loop = true;
    loopingAudio.play().catch(() => {});
  } catch {}
}

export function stopSoundLoop(): void {
  if (loopingAudio) {
    loopingAudio.pause();
    loopingAudio.currentTime = 0;
    loopingAudio = null;
  }
}
