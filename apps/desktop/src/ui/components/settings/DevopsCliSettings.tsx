import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { listen } from "@tauri-apps/api/event";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import {
  devopsCliService,
  INSTALL_PROGRESS_EVENT,
  type AvailableCli,
  type InstallProgress,
} from "../../../application/services/devopsCliService";

type RowState =
  | { kind: "idle" }
  | { kind: "installing"; phase: InstallProgress["phase"] }
  | { kind: "error"; message: string };

export function DevopsCliSettings() {
  const { t } = useT();

  const [clis, setClis] = createSignal<AvailableCli[]>([]);
  // Per-CLI install state, keyed by name. Indexing by name (not array index) keeps the row
  // state stable across `clis()` reloads — without this, a refetch after install briefly
  // shows stale phase markers because Solid re-renders the row before the map is updated.
  const [rowStates, setRowStates] = createSignal<Record<string, RowState>>({});
  const [loading, setLoading] = createSignal(true);

  // We keep a single subscription for all CLIs and dispatch by `payload.name` ourselves —
  // creating one subscription per install would race with `unlisten` if the user clicks
  // Install again before the previous handler is torn down.
  let unlisten: (() => void) | null = null;

  async function refresh() {
    const list = await devopsCliService.listAvailable();
    setClis(list);
    setLoading(false);
  }

  onMount(async () => {
    await refresh();
    // One subscription for all CLIs: row state is keyed by `payload.name`, so we don't need
    // the per-name filter that `devopsCliService.onInstallProgress` provides — that helper
    // is for components watching a single install.
    unlisten = await listen<InstallProgress>(INSTALL_PROGRESS_EVENT, (event) => {
      const p = event.payload;
      setRowStates((prev) => {
        const next = { ...prev };
        if (p.phase === "done") {
          next[p.name] = { kind: "idle" };
        } else if (p.phase === "failed") {
          next[p.name] = { kind: "error", message: p.error };
        } else {
          next[p.name] = { kind: "installing", phase: p.phase };
        }
        return next;
      });
      if (p.phase === "done" || p.phase === "failed") {
        // The installed/uninstalled flag changes, so we refetch the list.
        void refresh();
      }
    });
  });

  onCleanup(() => {
    unlisten?.();
  });

  async function install(name: string) {
    setRowStates((prev) => ({ ...prev, [name]: { kind: "installing", phase: "started" } }));
    try {
      await devopsCliService.install(name);
      // The "done" event handler resets the row + refreshes the list.
    } catch (e) {
      setRowStates((prev) => ({
        ...prev,
        [name]: { kind: "error", message: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  async function uninstall(name: string) {
    try {
      await devopsCliService.uninstall(name);
      await refresh();
    } catch (e) {
      setRowStates((prev) => ({
        ...prev,
        [name]: { kind: "error", message: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  function phaseLabel(phase: InstallProgress["phase"]): string {
    switch (phase) {
      case "started": return t("settings.devopsCliPhaseStarted");
      case "downloading": return t("settings.devopsCliPhaseDownloading");
      case "verifying": return t("settings.devopsCliPhaseVerifying");
      case "extracting": return t("settings.devopsCliPhaseExtracting");
      case "done": return t("settings.devopsCliPhaseDone");
      case "failed": return t("settings.devopsCliPhaseFailed");
    }
  }

  const headingStyle = { margin: "0 0 4px", "font-size": "20px", "font-weight": "600" as const, color: "var(--text-primary)" };
  const subHeadingStyle = { margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" };
  const cardStyle = {
    display: "flex",
    "align-items": "center",
    gap: "16px",
    padding: "12px 16px",
    background: "var(--bg-elevated)",
    "border-radius": "var(--radius-md)",
    "margin-bottom": "8px",
  };
  const metaStyle = { "font-size": "11px", color: "var(--text-muted)", "font-family": "monospace" };

  return (
    <div style={{ padding: "24px 32px", "max-width": "720px" }}>
      <h2 style={headingStyle}>{t("settings.devopsCliTitle")}</h2>
      <p style={subHeadingStyle}>{t("settings.devopsCliDesc")}</p>

      <Show when={!loading()} fallback={<p style={{ color: "var(--text-muted)" }}>{t("common.loading")}</p>}>
        <Show
          when={clis().length > 0}
          fallback={<p style={{ color: "var(--text-muted)", "font-size": "13px" }}>{t("settings.devopsCliEmpty")}</p>}
        >
          <For each={clis()}>
            {(cli) => {
              const state = () => rowStates()[cli.name] ?? { kind: "idle" as const };
              const isBusy = () => state().kind === "installing";
              return (
                <div style={cardStyle}>
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                      <span style={{ "font-weight": "600", color: "var(--text-primary)" }}>
                        {cli.display_name}
                      </span>
                      <span style={metaStyle}>{cli.name}</span>
                      <span style={metaStyle}>v{cli.version}</span>
                      <Show when={cli.installed}>
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "2px 6px",
                            "border-radius": "var(--radius-sm)",
                            background: "var(--success, #2ecc71)",
                            color: "#fff",
                            "font-weight": "600",
                            "text-transform": "uppercase",
                            "letter-spacing": "0.05em",
                          }}
                        >
                          {t("settings.devopsCliInstalled")}
                        </span>
                      </Show>
                    </div>
                    <a
                      href={cli.homepage}
                      target="_blank"
                      rel="noreferrer"
                      style={{ "font-size": "11px", color: "var(--text-muted)", "text-decoration": "none" }}
                    >
                      {cli.homepage}
                    </a>
                    <Show when={state().kind === "installing"}>
                      <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "4px" }}>
                        {phaseLabel((state() as { kind: "installing"; phase: InstallProgress["phase"] }).phase)}
                      </div>
                    </Show>
                    <Show when={state().kind === "error"}>
                      <div style={{ "font-size": "11px", color: "var(--danger, #e74c3c)", "margin-top": "4px" }}>
                        {(state() as { kind: "error"; message: string }).message}
                      </div>
                    </Show>
                  </div>
                  <div style={{ display: "flex", gap: "6px", "flex-shrink": "0" }}>
                    <Show
                      when={cli.installed}
                      fallback={
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isBusy()}
                          onClick={() => install(cli.name)}
                        >
                          {t("settings.devopsCliInstall")}
                        </Button>
                      }
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isBusy()}
                        onClick={() => uninstall(cli.name)}
                      >
                        {t("settings.devopsCliUninstall")}
                      </Button>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </Show>
    </div>
  );
}
