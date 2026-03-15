import { Show } from "solid-js";
import { createSignal } from "solid-js";
import { Button } from "./Button";

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

const [confirmState, setConfirmState] = createSignal<ConfirmState | null>(null);

export function requestConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    setConfirmState({
      message,
      onConfirm: () => {
        setConfirmState(null);
        resolve(true);
      },
    });
    // Also need to handle cancel — we patch it via the dismiss
    const unsubscribe = () => resolve(false);
    // Store the reject for dismiss
    (requestConfirm as any)._dismiss = () => {
      setConfirmState(null);
      unsubscribe();
    };
  });
}

function dismiss() {
  const fn = (requestConfirm as any)._dismiss;
  if (fn) fn();
  else setConfirmState(null);
}

export function ConfirmDialog() {
  return (
    <Show when={confirmState()}>
      {(state) => (
        <>
          {/* Backdrop */}
          <div
            onClick={dismiss}
            style={{
              position: "fixed",
              inset: "0",
              background: "rgba(0,0,0,0.5)",
              "z-index": "2000",
            }}
          />
          {/* Dialog */}
          <div style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            "z-index": "2001",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            "border-radius": "var(--radius-lg)",
            "box-shadow": "0 16px 48px var(--shadow-color)",
            padding: "24px",
            "min-width": "320px",
            "max-width": "440px",
            display: "flex",
            "flex-direction": "column",
            gap: "16px",
          }}>
            <div style={{
              "font-size": "14px",
              color: "var(--text-primary)",
              "line-height": "1.5",
              "word-break": "break-word",
            }}>
              {state().message}
            </div>
            <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
              <Button variant="secondary" size="sm" onClick={dismiss}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={state().onConfirm}>
                Supprimer
              </Button>
            </div>
          </div>
        </>
      )}
    </Show>
  );
}
