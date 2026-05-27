import { createSignal, createEffect, on, Show } from "solid-js";
import { useT } from "../../../i18n/context";
import { useViewStore } from "../../../application/stores/viewStore";
import { LlmSettings } from "./LlmSettings";
import { ThemeSettings } from "./ThemeSettings";
import { FocusSettings } from "./FocusSettings";
import { BriefSettings } from "./BriefSettings";
import { VpsSettings } from "./VpsSettings";
import { BookmarkSettings } from "./BookmarkSettings";
import { ProjectSettings } from "./ProjectSettings";
import { RoutineSettings } from "./RoutineSettings";
import { WebhookSettings } from "./WebhookSettings";
import { CalDavSettings } from "./CalDavSettings";
import { EmailRuleSettings } from "./EmailRuleSettings";
import { HabitSettings } from "./HabitSettings";
import { ShortcutSettings } from "./ShortcutSettings";
import { DataSettings } from "./DataSettings";
import { ConnectorSettings } from "./ConnectorSettings";
import { RssSettings } from "./RssSettings";
import { InfraSettings } from "./InfraSettings";
import { LocaleSettings } from "./LocaleSettings";
import { DevopsCliSettings } from "./DevopsCliSettings";
import { AiActivitySettings } from "./AiActivitySettings";
import { AiToolsSettings } from "./AiToolsSettings";

type SettingsTab = "locale" | "theme" | "llm" | "focus" | "connectors" | "brief" | "vps" | "bookmarks" | "projects" | "routines" | "webhooks" | "caldav" | "email-rules" | "habits" | "shortcuts" | "rss" | "infra" | "devops-cli" | "ai-activity" | "ai-tools" | "data";

export function SettingsView() {
  const { t } = useT();
  const { settingsTab, setSettingsTab } = useViewStore();
  const [tab, setTab] = createSignal<SettingsTab>("locale");

  // Open on a specific tab if requested (e.g. from AiButton → "llm")
  createEffect(on(settingsTab, (requested) => {
    if (requested && tabs.some((t) => t.id === requested)) {
      setTab(requested as SettingsTab);
      setSettingsTab(null);
    }
  }));

  const tabs: { id: SettingsTab; key: string }[] = [
    { id: "locale", key: "settings.language" },
    { id: "theme", key: "settings.theme" },
    { id: "focus", key: "settings.focus" },
    { id: "bookmarks", key: "settings.bookmarks" },
    { id: "projects", key: "settings.projects" },
    { id: "llm", key: "settings.llm" },
    { id: "brief", key: "settings.brief" },
    { id: "caldav", key: "settings.caldav" },
    { id: "email-rules", key: "settings.email" },
    { id: "rss", key: "settings.rss" },
    { id: "habits", key: "settings.habits" },
    { id: "routines", key: "settings.routines" },
    { id: "webhooks", key: "settings.webhooks" },
    { id: "shortcuts", key: "settings.shortcuts" },
    { id: "connectors", key: "settings.connectors" },
    { id: "vps", key: "settings.vps" },
    { id: "infra", key: "settings.infra" },
    { id: "devops-cli", key: "settings.devopsCli" },
    { id: "ai-activity", key: "settings.aiActivity" },
    { id: "ai-tools", key: "settings.aiTools" },
    { id: "data", key: "settings.data" },
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
          {t("settings.title")}
        </div>
        {tabs.map((tabDef) => (
          <button
            onClick={() => setTab(tabDef.id)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              border: "none",
              background: tab() === tabDef.id ? "var(--bg-elevated)" : "transparent",
              color: tab() === tabDef.id ? "var(--text-primary)" : "var(--text-muted)",
              "font-size": "13px",
              "text-align": "left",
              cursor: "pointer",
              "font-weight": tab() === tabDef.id ? "500" : "400",
            }}
          >
            {t(tabDef.key)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={tab() === "locale"}>
          <LocaleSettings />
        </Show>
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
        <Show when={tab() === "connectors"}>
          <ConnectorSettings />
        </Show>
        <Show when={tab() === "habits"}>
          <HabitSettings />
        </Show>
        <Show when={tab() === "routines"}>
          <RoutineSettings />
        </Show>
        <Show when={tab() === "webhooks"}>
          <WebhookSettings />
        </Show>
        <Show when={tab() === "caldav"}>
          <CalDavSettings />
        </Show>
        <Show when={tab() === "email-rules"}>
          <EmailRuleSettings />
        </Show>
        <Show when={tab() === "rss"}>
          <RssSettings />
        </Show>
        <Show when={tab() === "shortcuts"}>
          <ShortcutSettings />
        </Show>
        <Show when={tab() === "vps"}>
          <VpsSettings />
        </Show>
        <Show when={tab() === "infra"}>
          <InfraSettings />
        </Show>
        <Show when={tab() === "devops-cli"}>
          <DevopsCliSettings />
        </Show>
        <Show when={tab() === "ai-activity"}>
          <AiActivitySettings />
        </Show>
        <Show when={tab() === "ai-tools"}>
          <AiToolsSettings />
        </Show>
        <Show when={tab() === "data"}>
          <DataSettings />
        </Show>
      </div>
    </div>
  );
}
