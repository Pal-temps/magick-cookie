import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { API_BASE } from "../../../infrastructure/config";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";
import type { RemoteSession } from "../../../application/stores/aiSessionStore";
import { formatSessionInfo } from "./remoteControl";

interface RemoteControlModalProps {
  onClose: () => void;
}

export function RemoteControlModal(props: RemoteControlModalProps) {
  const { startRemoteSession, stopRemoteSession } = useAiSessionStore();
  const [session, setSession] = createSignal<RemoteSession | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [remainingSecs, setRemainingSecs] = createSignal(0);

  const vpsHost = API_BASE.replace(/\/api$/, "");

  async function start() {
    try {
      const result = await startRemoteSession(vpsHost, 30);
      setSession(result);
      setRemainingSecs(result.ttlSeconds);
    } catch (e) {
      setError(String(e));
    }
  }

  createEffect(() => {
    start();
  });

  // Countdown timer
  createEffect(() => {
    const s = session();
    if (!s) return;
    const interval = setInterval(() => {
      const info = formatSessionInfo({
        token: s.token,
        port: 0,
        expiresAt: new Date(s.expiresAt * 1000),
      });
      setRemainingSecs(info.remainingSeconds);
      if (info.remainingSeconds === 0) {
        clearInterval(interval);
        props.onClose();
      }
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  async function stop() {
    const s = session();
    if (s) {
      await stopRemoteSession(s.token);
    }
    props.onClose();
  }

  async function copyUrl() {
    const s = session();
    if (!s) return;
    await navigator.clipboard.writeText(s.relayUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div class="cc-config-overlay" onClick={stop}>
      <div class="cc-config-dialog cc-remote-modal" onClick={(e) => e.stopPropagation()}>
        <div class="cc-config-dialog__header">
          <span>Session mobile distante</span>
          <button class="cc-config-dialog__close" onClick={stop}>✕</button>
        </div>

        <div class="cc-config-dialog__body">
          <Show when={error()}>
            <div class="cc-remote-modal__error">{error()}</div>
          </Show>

          <Show when={!error()}>
            <Show when={!session()}>
              <div class="cc-remote-modal__loading">Démarrage de la session…</div>
            </Show>

            <Show when={session()}>
              {(s) => (
                <div class="cc-remote-modal__content">
                  <div class="cc-remote-modal__timer">
                    <span class="cc-remote-modal__timer-label">Expire dans</span>
                    <span class="cc-remote-modal__timer-value">{formatTime(remainingSecs())}</span>
                  </div>

                  <div class="cc-remote-modal__url-block">
                    <div class="cc-remote-modal__url-label">URL mobile</div>
                    <div class="cc-remote-modal__url-row">
                      <code class="cc-remote-modal__url">{s().relayUrl}</code>
                      <button class="cc-remote-modal__copy" onClick={copyUrl}>
                        {copied() ? "Copié ✓" : "Copier"}
                      </button>
                    </div>
                    <div class="cc-remote-modal__hint">
                      Ouvrez cette URL sur votre mobile pour contrôler la session à distance.
                    </div>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </div>

        <div class="cc-config-dialog__footer">
          <button class="cc-config-dialog__btn cc-config-dialog__btn--cancel" onClick={stop}>
            Arrêter la session
          </button>
        </div>
      </div>
    </div>
  );
}
