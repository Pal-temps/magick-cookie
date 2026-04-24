import { createSignal, createResource, Show, For } from "solid-js";
import { useSecretsStore } from "../../../application/stores/secretsStore";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { useNotesStore } from "../../../application/stores/notesStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { useT } from "../../../i18n/context";

interface Step {
  key: string;
  done: () => boolean;
  label: () => string;
  doneLabel: () => string;
  hint: () => string;
  action: () => void;
}

export function SetupChecklist() {
  const { t } = useT();
  const secrets = useSecretsStore();
  const { calendars } = useCalendarStore();
  const notes = useNotesStore();
  const { setViewMode } = useViewStore();
  const [dismissed, setDismissed] = createSignal(localStorage.getItem("setup-dismissed") === "1");

  // Delegates to notesStore so no UI component talks to `invoke` directly.
  const [vaultConfigured] = createResource(async () => {
    try {
      const config = await notes.loadConfig();
      return !!config?.path;
    } catch {
      return false;
    }
  });

  const steps: Step[] = [
    {
      key: "vault",
      done: () => vaultConfigured() ?? false,
      label: () => t("setup.vault"),
      doneLabel: () => t("setup.vaultDone"),
      hint: () => t("setup.vaultHint"),
      action: () => setViewMode("settings"),
    },
    {
      key: "secrets",
      done: () => secrets.isUnlocked(),
      label: () => t("setup.secrets"),
      doneLabel: () => t("setup.secretsDone"),
      hint: () => t("setup.secretsHint"),
      action: () => setViewMode("passwords"),
    },
    {
      key: "calendar",
      done: () => calendars().length > 0,
      label: () => t("setup.calendar"),
      doneLabel: () => t("setup.calendarDone"),
      hint: () => t("setup.calendarHint"),
      action: () => setViewMode("month"),
    },
  ];

  const allDone = () => steps.every((s) => s.done());
  const completedCount = () => steps.filter((s) => s.done()).length;

  function dismiss() {
    localStorage.setItem("setup-dismissed", "1");
    setDismissed(true);
  }

  return (
    <Show when={!dismissed() && !allDone()}>
      <div class="dashboard-card" style={{ "grid-column": "1 / -1", "margin-bottom": "4px" }}>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "12px" }}>
            <div>
              <h3 style={{ margin: "0 0 4px", "font-size": "15px", "font-weight": "600", color: "var(--text-primary)" }}>
                {t("setup.title")}
              </h3>
              <p style={{ margin: "0", "font-size": "12px", color: "var(--text-secondary)" }}>
                {t("setup.subtitle")}
              </p>
            </div>
            <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
              <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
                {completedCount()}/{steps.length}
              </span>
              <button
                onClick={dismiss}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: "4px",
                  color: "var(--text-muted)", "font-size": "11px",
                }}
              >
                {t("setup.dismiss")}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: "3px", background: "var(--bg-elevated)", "border-radius": "2px",
            "margin-bottom": "14px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${(completedCount() / steps.length) * 100}%`,
              background: "var(--accent-primary)", "border-radius": "2px",
              transition: "width 0.3s ease",
            }} />
          </div>

          <div style={{ display: "flex", gap: "12px", "flex-wrap": "wrap" }}>
            <For each={steps}>
              {(step) => (
                <button
                  onClick={() => { if (!step.done()) step.action(); }}
                  style={{
                    flex: "1", "min-width": "180px", padding: "10px 14px",
                    background: step.done() ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)" : "var(--bg-elevated)",
                    border: `1px solid ${step.done() ? "color-mix(in srgb, var(--accent-primary) 25%, transparent)" : "var(--border-color)"}`,
                    "border-radius": "var(--radius-md)", cursor: step.done() ? "default" : "pointer",
                    "text-align": "left", transition: "var(--transition-fast)",
                  }}
                >
                  <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "4px" }}>
                    <div style={{
                      width: "18px", height: "18px", "border-radius": "50%", "flex-shrink": "0",
                      display: "flex", "align-items": "center", "justify-content": "center",
                      background: step.done() ? "var(--accent-primary)" : "transparent",
                      border: step.done() ? "none" : "1.5px solid var(--text-muted)",
                      color: "white", "font-size": "11px",
                    }}>
                      <Show when={step.done()}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </Show>
                    </div>
                    <span style={{
                      "font-size": "13px", "font-weight": "500",
                      color: step.done() ? "var(--accent-primary)" : "var(--text-primary)",
                    }}>
                      {step.done() ? step.doneLabel() : step.label()}
                    </span>
                  </div>
                  <Show when={!step.done()}>
                    <p style={{ margin: "0", "padding-left": "26px", "font-size": "11px", color: "var(--text-muted)" }}>
                      {step.hint()}
                    </p>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
