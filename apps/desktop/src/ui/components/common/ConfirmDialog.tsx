import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { Button } from "./Button";
import { useT } from "../../../i18n/context";

// Pending confirm — holds both resolvers so cancel/confirm can settle the promise without
// patching the exported function with a private `_dismiss` field (the previous anti-pattern).
interface Pending {
  message: string;
  resolve: (value: boolean) => void;
}

const [pending, setPending] = createSignal<Pending | null>(null);

export function requestConfirm(message: string): Promise<boolean> {
  // If a previous dialog is still open, reject it as cancelled so we never stack two at once.
  const prev = pending();
  if (prev) prev.resolve(false);

  return new Promise<boolean>((resolve) => {
    setPending({ message, resolve });
  });
}

function settle(value: boolean) {
  const current = pending();
  if (!current) return;
  setPending(null);
  current.resolve(value);
}

export function ConfirmDialog() {
  const { t } = useT();

  // Escape-to-cancel. Attached while this component is mounted.
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pending()) settle(false);
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  return (
    <Show when={pending()}>
      {(state) => (
        <>
          {/* Backdrop */}
          <div
            role="presentation"
            onClick={() => settle(false)}
            style={{
              position: "fixed",
              inset: "0",
              background: "rgba(0,0,0,0.5)",
              "z-index": "2000",
            }}
          />
          {/* Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("common.confirm") || "Confirm"}
            style={{
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
            }}
          >
            <div
              style={{
                "font-size": "14px",
                color: "var(--text-primary)",
                "line-height": "1.5",
                "word-break": "break-word",
              }}
            >
              {state().message}
            </div>
            <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
              <Button variant="secondary" size="sm" onClick={() => settle(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" size="sm" onClick={() => settle(true)}>
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </>
      )}
    </Show>
  );
}
