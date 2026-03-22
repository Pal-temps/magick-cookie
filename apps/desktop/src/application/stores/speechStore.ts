import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { startRecording, stopRecording } from "../services/audioRecorder";
import { parseEventFromText } from "../services/eventParser";
import { useCalendarStore } from "./calendarStore";

const [isRecording, setIsRecording] = createSignal(false);
const [isTranscribing, setIsTranscribing] = createSignal(false);
const [isModelReady, setIsModelReady] = createSignal(false);
const [isDownloading, setIsDownloading] = createSignal(false);
const [downloadProgress, setDownloadProgress] = createSignal(0);
const [lastTranscript, setLastTranscript] = createSignal("");

export function useSpeechStore() {
  const { openCreateFormWithData } = useCalendarStore();

  async function checkModel() {
    const ready = await invoke<boolean>("check_whisper_model");
    setIsModelReady(ready);
    return ready;
  }

  async function downloadModel() {
    setIsDownloading(true);
    setDownloadProgress(0);

    const unlisten = await listen<{ percent: number }>("whisper-download-progress", (event) => {
      setDownloadProgress(event.payload.percent);
    });

    try {
      await invoke("download_whisper_model");
      setIsModelReady(true);
    } finally {
      unlisten();
      setIsDownloading(false);
    }
  }

  async function startSpeechRecording() {
    try {
      if (!isModelReady()) {
        const ready = await checkModel();
        if (!ready) {
          await downloadModel();
        }
      }

      await startRecording();
      setIsRecording(true);
    } catch (err) {
      console.error("[speech] startRecording error:", err);
      setIsRecording(false);
      setIsDownloading(false);
    }
  }

  async function stopAndTranscribe() {
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const { samples, sampleRate } = await stopRecording();
      const text = await invoke<string>("transcribe_audio", {
        samples: Array.from(samples),
        sampleRate,
      });

      setLastTranscript(text);

      if (text.trim()) {
        const parsed = parseEventFromText(text);
        openCreateFormWithData(parsed);
      }
    } catch (err) {
      console.error("[speech] transcribe error:", err);
    } finally {
      setIsTranscribing(false);
    }
  }

  return {
    isRecording,
    isTranscribing,
    isModelReady,
    isDownloading,
    downloadProgress,
    lastTranscript,
    checkModel,
    downloadModel,
    startSpeechRecording,
    stopAndTranscribe,
  };
}
