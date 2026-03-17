import { createSignal, Show } from "solid-js";
import { LlmSettings } from "./LlmSettings";
import { ThemeSettings } from "./ThemeSettings";
import { FocusSettings } from "./FocusSettings";
import { GitHubSettings } from "./GitHubSettings";
import { BriefSettings } from "./BriefSettings";
import { VpsSettings } from "./VpsSettings";
import { BookmarkSettings } from "./BookmarkSettings";
import { ProjectSettings } from "./ProjectSettings";

type SettingsTab = "theme" | "llm" | "focus" | "github" | "brief" | "vps" | "bookmarks" | "projects";

export function SettingsView() {
  const [tab, setTab] = createSignal<SettingsTab>("theme");

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "theme", label: "Apparence" },
    { id: "focus", label: "Focus" },
    { id: "bookmarks", label: "Signets" },
    { id: "projects", label: "Projets" },
    { id: "llm", label: "Intelligence artificielle" },
    { id: "brief", label: "Brief" },
    { id: "github", label: "GitHub" },
    { id: "vps", label: "VPS" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{
        width: "200px",
        "flex-shrink": "0",
        "border-right": "1px solid var(--border-color)",
        padding: "16px 0",
        "overflow-y": "auto",
      }}>
        <div style={{
          padding: "0 16px 12px",
          "font-size": "11px",
          "font-weight": "600",
          "text-transform": "uppercase",
          "letter-spacing": "0.05em",
          color: "var(--text-muted)",
        }}>
          Parametres
        </div>
        {tabs.map((t) => (
          <button
            onClick={() => setTab(t.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              border: "none",
              background: tab() === t.id ? "var(--bg-elevated)" : "transparent",
              color: tab() === t.id ? "var(--text-primary)" : "var(--text-muted)",
              "font-size": "13px",
              "text-align": "left",
              cursor: "pointer",
              "font-weight": tab() === t.id ? "500" : "400",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={tab() === "theme"}>
          <ThemeSettings />
        </Show>
        <Show when={tab() === "focus"}>
          <FocusSettings />
        </Show>
        <Show when={tab() === "llm"}>
          <LlmSettings />
        </Show>
        <Show when={tab() === "brief"}>
          <BriefSettings />
        </Show>
        <Show when={tab() === "bookmarks"}>
          <BookmarkSettings />
        </Show>
        <Show when={tab() === "projects"}>
          <ProjectSettings />
        </Show>
        <Show when={tab() === "github"}>
          <GitHubSettings />
        </Show>
        <Show when={tab() === "vps"}>
          <VpsSettings />
        </Show>
      </div>
    </div>
  );
}
