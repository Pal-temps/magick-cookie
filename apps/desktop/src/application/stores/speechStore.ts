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
      console.log("[speech] Starting...");
      // Check model first
      if (!isModelReady()) {
        console.log("[speech] Checking model...");
        const ready = await checkModel();
        console.log("[speech] Model ready:", ready);
        if (!ready) {
          console.log("[speech] Downloading model...");
          await downloadModel();
          console.log("[speech] Download complete");
        }
      }

      console.log("[speech] Requesting microphone...");
      await startRecording();
      setIsRecording(true);
      console.log("[speech] Recording started");
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
      console.log(`[speech] Sending ${samples.length} samples at ${sampleRate}Hz`);
      const text = await invoke<string>("transcribe_audio", {
        samples: Array.from(samples),
        sampleRate,
      });

      console.log("[speech] Transcript:", text);
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
