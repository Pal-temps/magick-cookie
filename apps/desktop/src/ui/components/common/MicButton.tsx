import { Show } from "solid-js";
import { useSpeechStore } from "../../../application/stores/speechStore";

export function MicButton() {
  const {
    isRecording, isTranscribing, isDownloading, downloadProgress,
    startSpeechRecording, stopAndTranscribe,
  } = useSpeechStore();

  const handleClick = () => {
    console.log("[mic] clicked!", { recording: isRecording(), transcribing: isTranscribing(), downloading: isDownloading() });
    if (isRecording()) {
      stopAndTranscribe().catch((e) => console.error("[mic] stop error:", e));
    } else if (!isTranscribing() && !isDownloading()) {
      startSpeechRecording().catch((e) => console.error("[mic] start error:", e));
    }
  };

  const buttonStyle = () => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: "32px",
    height: "32px",
    "border-radius": "var(--radius-md)",
    border: isRecording() ? "2px solid var(--cal-red)" : "1px solid transparent",
    background: isRecording() ? "rgba(239,68,68,0.1)" : "transparent",
    cursor: isTranscribing() || isDownloading() ? "wait" : "pointer",
    color: isRecording() ? "var(--cal-red)" : "var(--text-secondary)",
    transition: "all 0.15s ease",
    padding: "0",
    position: "relative" as const,
  });

  return (
    <button
      onClick={handleClick}
      style={buttonStyle()}
      title={
        isDownloading() ? `Telechargement du modele... ${downloadProgress()}%`
        : isTranscribing() ? "Transcription en cours..."
        : isRecording() ? "Cliquer pour arreter"
        : "Dicter un evenement"
      }
      disabled={isDownloading()}
    >
      <Show when={isDownloading()}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset={28 - (28 * downloadProgress()) / 100} stroke-linecap="round" transform="rotate(-90 8 8)" />
        </svg>
      </Show>

      <Show when={isTranscribing()}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="8" stroke-linecap="round" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Show>

      <Show when={!isTranscribing() && !isDownloading()}>
        {/* Mic icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        {/* Pulsing red dot when recording */}
        <Show when={isRecording()}>
          <span style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "6px",
            height: "6px",
            "border-radius": "50%",
            background: "var(--cal-red)",
            animation: "pulse 1s ease-in-out infinite",
          }} />
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </Show>
      </Show>
    </button>
  );
}
