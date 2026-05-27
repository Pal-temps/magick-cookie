import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import { useT } from "../../../i18n/context";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { api } from "../../../infrastructure/api/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type PermissionLevel = "auto" | "user-confirm" | "admin";

interface AiToolEntry {
  name: string;
  description: string;
  category: string;
  permissionLevel: PermissionLevel;
  disabled: boolean;
}

// ─── Category display order ───────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "calendar", "tasks", "notes", "contacts", "email",
  "github", "gitlab", "git", "ssh", "dns",
  "analytics", "brief", "rss", "bookmarks", "snippets",
  "skills", "routines", "alarms", "timer", "memory",
  "deploy", "clickup", "infra", "other",
];

function categorySort(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiToolsSettings() {
  const { t } = useT();
  const settings = useSettingsStore();

  const [tools, setTools] = createSignal<AiToolEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [saved, setSaved] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  // ── Load tool list ─────────────────────────────────────────────────────────
  onMount(async () => {
    try {
      const res = await api.getRaw<{ data: AiToolEntry[] }>("/api/ai/tools");
      const data = (res as any)?.data ?? [];
      // Merge server `disabled` flag with local store (store is source of truth)
      const localDisabled = new Set(settings.getAiTools().disabledTools);
      setTools(data.map((t: AiToolEntry) => ({ ...t, disabled: localDisabled.has(t.name) })));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  });

  // ── Persist changes ────────────────────────────────────────────────────────
  async function persist(disabledTools: string[]) {
    setSaving(true);
    setSaved(false);
    // 1. Update local store (localStorage + vault sync)
    settings.patchAiTools({ disabledTools });
    // 2. Push to API so the in-memory ToolRegistry is updated immediately
    try {
      const snapshot = settings.getSnapshot();
      await api.put("/api/user-preferences", snapshot);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Non-fatal: API may be unreachable; local store is persisted
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle a single tool ───────────────────────────────────────────────────
  async function toggleTool(name: string, nowDisabled: boolean) {
    const current = tools();
    const updated = current.map((t) =>
      t.name === name ? { ...t, disabled: nowDisabled } : t,
    );
    setTools(updated);
    const disabledList = updated.filter((t) => t.disabled).map((t) => t.name);
    await persist(disabledList);
  }

  // ── Enable / disable all ───────────────────────────────────────────────────
  async function setAll(disable: boolean) {
    const current = tools();
    const updated = current.map((t) => ({ ...t, disabled: disable }));
    setTools(updated);
    const disabledList = disable ? updated.map((t) => t.name) : [];
    await persist(disabledList);
  }

  // ── Filtered + grouped ────────────────────────────────────────────────────
  const filtered = createMemo(() => {
    const q = search().toLowerCase().trim();
    return q
      ? tools().filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q),
        )
      : tools();
  });

  const grouped = createMemo(() => {
    const map = new Map<string, AiToolEntry[]>();
    for (const tool of filtered()) {
      const cat = tool.category || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tool);
    }
    return [...map.entries()].sort(([a], [b]) => categorySort(a, b));
  });

  const totalEnabled = createMemo(() => tools().filter((t) => !t.disabled).length);
  const totalTools = createMemo(() => tools().length);

  // ── Permission badge ──────────────────────────────────────────────────────
  function permLabel(level: PermissionLevel): string {
    if (level === "user-confirm") return t("settings.aiToolsPermConfirm");
    if (level === "admin") return t("settings.aiToolsPermAdmin");
    return t("settings.aiToolsPermAuto");
  }

  function permColor(level: PermissionLevel): string {
    if (level === "user-confirm") return "#f39c12";
    if (level === "admin") return "var(--danger, #e74c3c)";
    return "var(--text-muted)";
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", "max-width": "760px" }}>
      {/* Header */}
      <div style={{ "margin-bottom": "8px" }}>
        <h2 style={{ margin: "0 0 6px", "font-size": "18px" }}>
          {t("settings.aiToolsTitle")}
        </h2>
        <p style={{ margin: "0 0 16px", color: "var(--text-muted)", "font-size": "13px", "line-height": "1.5" }}>
          {t("settings.aiToolsDesc")}
        </p>
      </div>

      {/* Search + global actions */}
      <div style={{ display: "flex", gap: "8px", "margin-bottom": "16px", "align-items": "center" }}>
        <input
          type="text"
          placeholder={t("settings.aiToolsSearch")}
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style={{
            flex: "1",
            padding: "7px 10px",
            "border-radius": "6px",
            border: "1px solid var(--border-color)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            "font-size": "13px",
          }}
        />
        <span style={{ "font-size": "12px", color: "var(--text-muted)", "white-space": "nowrap" }}>
          {totalEnabled()}/{totalTools()}
        </span>
        <button
          onClick={() => setAll(false)}
          style={{
            padding: "6px 10px",
            "border-radius": "6px",
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-muted)",
            "font-size": "12px",
            cursor: "pointer",
          }}
        >
          {t("settings.aiToolsEnableAll")}
        </button>
        <button
          onClick={() => setAll(true)}
          style={{
            padding: "6px 10px",
            "border-radius": "6px",
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-muted)",
            "font-size": "12px",
            cursor: "pointer",
          }}
        >
          {t("settings.aiToolsDisableAll")}
        </button>
        <Show when={saving()}>
          <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>…</span>
        </Show>
        <Show when={saved()}>
          <span style={{ "font-size": "12px", color: "var(--success, #2ecc71)" }}>
            ✓ {t("settings.aiToolsSaved")}
          </span>
        </Show>
      </div>

      {/* States */}
      <Show when={loading()}>
        <p style={{ color: "var(--text-muted)", "font-size": "13px" }}>
          {t("settings.aiToolsLoading")}
        </p>
      </Show>
      <Show when={loadError()}>
        <p style={{ color: "var(--danger, #e74c3c)", "font-size": "13px" }}>
          {loadError()}
        </p>
      </Show>
      <Show when={!loading() && !loadError() && filtered().length === 0}>
        <p style={{ color: "var(--text-muted)", "font-size": "13px" }}>
          {t("settings.aiToolsNoResults")}
        </p>
      </Show>

      {/* Tool groups */}
      <For each={grouped()}>
        {([category, toolList]) => (
          <div style={{ "margin-bottom": "24px" }}>
            {/* Category header */}
            <div style={{
              "font-size": "11px",
              "font-weight": "600",
              "text-transform": "uppercase",
              "letter-spacing": "0.06em",
              color: "var(--text-muted)",
              "margin-bottom": "8px",
              "border-bottom": "1px solid var(--border-color)",
              "padding-bottom": "4px",
            }}>
              {category}
            </div>

            {/* Tool rows */}
            <For each={toolList}>
              {(tool) => (
                <div style={{
                  display: "flex",
                  "align-items": "flex-start",
                  gap: "12px",
                  padding: "8px 0",
                  "border-bottom": "1px solid var(--border-subtle, rgba(0,0,0,0.05))",
                  opacity: tool.disabled ? "0.55" : "1",
                  transition: "opacity 0.15s",
                }}>
                  {/* Toggle */}
                  <label style={{
                    position: "relative",
                    display: "inline-block",
                    width: "36px",
                    height: "20px",
                    "flex-shrink": "0",
                    "margin-top": "2px",
                    cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={!tool.disabled}
                      onChange={(e) => toggleTool(tool.name, !e.currentTarget.checked)}
                      style={{ opacity: "0", width: "0", height: "0", position: "absolute" }}
                    />
                    {/* Track */}
                    <span style={{
                      position: "absolute",
                      inset: "0",
                      "background-color": tool.disabled ? "var(--border-color)" : "var(--accent, #3498db)",
                      "border-radius": "20px",
                      transition: "background-color 0.2s",
                    }} />
                    {/* Thumb */}
                    <span style={{
                      position: "absolute",
                      height: "14px",
                      width: "14px",
                      left: tool.disabled ? "3px" : "19px",
                      bottom: "3px",
                      "background-color": "white",
                      "border-radius": "50%",
                      transition: "left 0.2s",
                    }} />
                  </label>

                  {/* Text */}
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-wrap": "wrap" }}>
                      <span style={{
                        "font-size": "13px",
                        "font-weight": "500",
                        "font-family": "monospace",
                        color: "var(--text-primary)",
                      }}>
                        {tool.name}
                      </span>
                      <Show when={tool.permissionLevel !== "auto"}>
                        <span style={{
                          "font-size": "10px",
                          padding: "1px 6px",
                          "border-radius": "4px",
                          border: `1px solid ${permColor(tool.permissionLevel)}`,
                          color: permColor(tool.permissionLevel),
                          "white-space": "nowrap",
                        }}>
                          {permLabel(tool.permissionLevel)}
                        </span>
                      </Show>
                    </div>
                    <p style={{
                      margin: "2px 0 0",
                      "font-size": "12px",
                      color: "var(--text-muted)",
                      "line-height": "1.4",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                    }}>
                      {tool.description}
                    </p>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
