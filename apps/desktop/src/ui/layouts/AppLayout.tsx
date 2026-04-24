import type { JSX } from "solid-js";
import { Show, For, Switch, Match } from "solid-js";
import { useT } from "../../i18n/context";
import { formatDate } from "../../i18n/format";
import { useViewStore } from "../../application/stores/viewStore";
import { useCalendarStore } from "../../application/stores/calendarStore";
import { useTaskStore } from "../../application/stores/taskStore";
import { useDesktopModeStore } from "../../application/stores/desktopModeStore";
import { useEmailStore } from "../../application/stores/emailStore";
import { useRssStore } from "../../application/stores/rssStore";
import { useSpeechStore } from "../../application/stores/speechStore";
import { useDogWalkStore } from "../../application/stores/dogWalkStore";
import { TitleBar } from "../components/common/TitleBar";
import { OfflineIndicator } from "../components/common/OfflineIndicator";
import { MiniTimer } from "../components/common/MiniTimer";
import { MiniDogWalk } from "../components/common/MiniDogWalk";
import { MiniCalendar } from "../components/sidebar/MiniCalendar";
import { CalendarSidebarContent } from "../components/sidebar/CalendarSidebarContent";
import { AccountSidebar } from "../components/email/AccountSidebar";
import { DashboardSidebarContent } from "../components/sidebar/DashboardSidebarContent";
import { IdeSidebarContent } from "../components/sidebar/IdeSidebarContent";
import { NotesSidebarContent } from "../components/sidebar/NotesSidebarContent";
import { FluxSidebarContent } from "../components/sidebar/FluxSidebarContent";
import { CollapsibleSection } from "../components/common/CollapsibleSection";
import { Button } from "../components/common/Button";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { useBookmarkStore } from "../../application/stores/bookmarkStore";
import { openUrl } from "@tauri-apps/plugin-opener";

interface AppLayoutProps {
  children: JSX.Element;
}

export function AppLayout(props: AppLayoutProps) {
  const { t, locale } = useT();
  const viewStore = useViewStore();
  const { viewMode, setViewMode, currentDate, navigatePrev, navigateNext, goToToday, sidebarVisible } = viewStore;
  const { openCreateForm, setShowAiGenerator } = useCalendarStore();
  const emailStore = useEmailStore();
  const rssStore = useRssStore();
  const { syncConnector, isSyncing } = useTaskStore();
  const { enterDesktop } = useDesktopModeStore();
  const { startSpeechRecording } = useSpeechStore();
  const { startWalk, stopWalk, activeWalk } = useDogWalkStore();
  const { favorites } = useBookmarkStore();

  const headerTitle = () => {
    return formatDate(currentDate(), locale(), { month: "long", year: "numeric" });
  };

  // --- Menu definitions ---
  const menus = () => [
    {
      label: t("menu.file"),
      items: [
        { label: t("calendar.newEvent"), shortcut: "Ctrl+N", action: openCreateForm },
        { label: "Dicter un evenement", action: () => startSpeechRecording() },
        { separator: true, label: "" },
        { label: "Sync ClickUp", action: () => syncConnector("clickup"), disabled: isSyncing() },
        { separator: true, label: "" },
        { label: "Mode bureau", action: enterDesktop },
        { separator: true, label: "" },
        { label: "Quitter", shortcut: "Alt+F4", action: () => { /* handled by window close */ } },
      ],
    },
    {
      label: t("menu.view"),
      items: [
        { label: t("nav.dashboard"), action: () => setViewMode("dashboard"), shortcut: "Ctrl+D" },
        { separator: true, label: "" },
        { label: t("menu.month"), action: () => setViewMode("month"), shortcut: "Ctrl+1" },
        { label: t("menu.week"), action: () => setViewMode("week"), shortcut: "Ctrl+2" },
        { label: t("menu.day"), action: () => setViewMode("day"), shortcut: "Ctrl+3" },
        { separator: true, label: "" },
        { label: t("menu.today"), action: goToToday, shortcut: "Ctrl+T" },
        { separator: true, label: "" },
        { label: t("nav.cookia"), action: () => setViewMode("ide"), shortcut: "Ctrl+4" },
        { label: t("menu.notesSchemas"), action: () => setViewMode("notes") },
        { label: t("nav.tasks"), action: () => setViewMode("flux"), shortcut: "Ctrl+5" },
        { label: t("nav.email"), action: () => setViewMode("email"), shortcut: "Ctrl+6" },
        { label: "Crookies", action: () => { viewStore.setNotesMainTab("bookmarks"); setViewMode("notes"); }, shortcut: "Ctrl+7" },
        { label: t("nav.rss"), action: () => setViewMode("rss") },
        { label: t("nav.cicd"), action: () => setViewMode("cicd") },
        { label: t("nav.servers"), action: () => setViewMode("vps"), shortcut: "Ctrl+9" },
        { label: t("nav.tools"), action: () => setViewMode("tools") },
      ],
    },
    {
      label: t("menu.tools"),
      items: [
        {
          label: activeWalk() ? t("menu.stopWalk") : t("menu.startWalk"),
          action: () => activeWalk() ? stopWalk() : startWalk(),
        },
        { separator: true, label: "" },
        { label: t("menu.stats"), action: () => setViewMode("dashboard") },
        { label: t("menu.envChangelog"), action: () => setViewMode("tools") },
        { separator: true, label: "" },
        { label: t("nav.settings"), action: () => setViewMode("settings"), shortcut: "Ctrl+," },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100vh", background: "var(--bg-base)" }}>
      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Title bar */}
      <TitleBar
        menus={menus()}
        rightSlot={
          <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-right": "4px" }}>
            <MiniTimer />
            <MiniDogWalk />
          </div>
        }
      />

      {/* Main layout */}
      <div style={{ display: "flex", flex: "1", overflow: "hidden" }}>
        {/* Sidebar */}
        <Show when={sidebarVisible()}>
        <aside style={{
          width: "var(--sidebar-width)",
          "min-width": "var(--sidebar-width)",
          background: "var(--bg-surface)",
          "border-right": "1px solid var(--border-color)",
          display: "flex",
          "flex-direction": "column",
          overflow: "hidden",
        }}>
          {/* Mini calendar — hidden in IDE mode */}
          <Show when={viewMode() !== "ide"}>
            <MiniCalendar />
          </Show>

          {/* Context-aware content */}
          <Switch>
            <Match when={viewMode() === "dashboard"}>
              <DashboardSidebarContent />
            </Match>
            <Match when={["month", "week", "day"].includes(viewMode())}>
              <CalendarSidebarContent />
            </Match>
            <Match when={viewMode() === "email"}>
              <div style={{ flex: "1", overflow: "hidden", display: "flex", "flex-direction": "column", "border-top": "1px solid var(--border-color)" }}>
                <div class="email-sidebar" style={{ width: "100%", border: "none" }}>
                  <AccountSidebar
                    accounts={emailStore.accounts()}
                    activeAccountId={emailStore.activeAccountId()}
                    activeFolder={emailStore.activeFolder()}
                    unreadPerAccount={emailStore.unreadPerAccount()}
                    totalUnread={emailStore.unreadCount()}
                    getAccountColor={emailStore.getAccountColor}
                    onSelectAccount={(id, folder) => {
                      emailStore.setActiveAccountId(id);
                      if (folder) emailStore.setActiveFolder(folder);
                    }}
                    onSelectFolder={(id, folder) => {
                      emailStore.setActiveAccountId(id);
                      emailStore.setActiveFolder(folder);
                    }}
                  />
                </div>
              </div>
            </Match>
            <Match when={viewMode() === "rss"}>
              <div style={{ flex: "1", overflow: "hidden", display: "flex", "flex-direction": "column", "border-top": "1px solid var(--border-color)" }}>
                <div class="rss-sidebar" style={{ width: "100%", border: "none" }}>
                  <div class="rss-sidebar__header">Feeds</div>
                  <div class="rss-sidebar__tree">
                    <button
                      class={`rss-sidebar__all ${rssStore.activeFeedId() === null ? "rss-sidebar__all--active" : ""}`}
                      onClick={() => { rssStore.setActiveFeedId(null); rssStore.selectArticle(null); }}
                    >
                      <span>Tous les articles</span>
                      <Show when={rssStore.unreadCount() > 0}>
                        <span class="rss-feed-item__badge rss-feed-item__badge--unread">{rssStore.unreadCount()}</span>
                      </Show>
                    </button>
                    <div class="rss-sidebar__divider" />
                    <For each={rssStore.feeds()}>
                      {(feed) => (
                        <div class={`rss-feed-item ${rssStore.activeFeedId() === feed.id ? "rss-feed-item--active" : ""}`}>
                          <button
                            class="rss-feed-item__name"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", "font-size": "inherit", "text-align": "left", padding: "0" }}
                            onClick={() => { rssStore.setActiveFeedId(feed.id); rssStore.selectArticle(null); }}
                          >
                            {feed.label}
                          </button>
                          <Show when={rssStore.unreadPerFeed()[feed.id]}>
                            <span class="rss-feed-item__badge rss-feed-item__badge--unread">{rssStore.unreadPerFeed()[feed.id]}</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Match>
            <Match when={viewMode() === "flux"}>
              <FluxSidebarContent />
            </Match>
            <Match when={viewMode() === "notes"}>
              <NotesSidebarContent />
            </Match>
            <Match when={viewMode() === "ide"}>
              <IdeSidebarContent />
            </Match>
            <Match when={true}>
              {/* Default: favoris only */}
              <Show when={favorites().length > 0}>
                <div style={{ "border-top": "1px solid var(--border-color)" }}>
                  <CollapsibleSection
                    title="Favoris"
                    defaultOpen={false}
                    badge={
                      <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                        {favorites().length}
                      </span>
                    }
                  >
                    <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
                      <For each={favorites()}>
                        {(bookmark) => (
                          <button
                            onClick={() => openUrl(bookmark.url)}
                            style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 0", "font-size": "12px", color: "var(--text-primary)", cursor: "pointer", background: "none", border: "none", width: "100%", "text-align": "left" }}
                            title={bookmark.url}
                          >
                            <span style={{ "font-size": "13px" }}>{bookmark.emoji ?? "🔗"}</span>
                            <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{bookmark.name}</span>
                          </button>
                        )}
                      </For>
                      <button
                        onClick={() => { viewStore.setNotesMainTab("bookmarks"); setViewMode("notes"); }}
                        style={{ display: "flex", "align-items": "center", gap: "6px", padding: "4px 0", "font-size": "11px", color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", width: "100%", "text-align": "left", "margin-top": "4px" }}
                      >Gerer les crookies...</button>
                    </div>
                  </CollapsibleSection>
                </div>
              </Show>
            </Match>
          </Switch>
        </aside>
        </Show>

        {/* Main */}
        <main style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
          {/* Navigation bar */}
          <header style={{
            height: "var(--header-height)",
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "0 16px",
            "border-bottom": "1px solid var(--border-color)",
            "flex-shrink": "0",
          }}>
            <div class="nav-tabs-scroll">
              <For each={[
                { id: "dashboard", key: "nav.dashboard", match: (v: string) => v === "dashboard" },
                { id: "month", key: "nav.calendar", match: (v: string) => ["month", "week", "day"].includes(v) },
                { id: "ide", key: "nav.cookia", match: (v: string) => v === "ide" },
                { id: "notes", key: "nav.notes", match: (v: string) => v === "notes" },
                { id: "flux", key: "nav.tasks", match: (v: string) => v === "flux" },
                { id: "email", key: "nav.email", match: (v: string) => v === "email" },
                { id: "rss", key: "nav.rss", match: (v: string) => v === "rss" },
                { id: "cicd", key: "nav.cicd", match: (v: string) => v === "cicd" },
                { id: "vps", key: "nav.servers", match: (v: string) => v === "vps" },
                { id: "tools", key: "nav.tools", match: (v: string) => v === "tools" },
                { id: "browser", key: "nav.browser", match: (v: string) => v === "browser" },
              ] as const}>
                {(item) => (
                  <button
                    onClick={() => setViewMode(item.id as any)}
                    style={{
                      padding: "4px 8px",
                      "border-radius": "var(--radius-sm)",
                      "font-size": "12px",
                      "white-space": "nowrap",
                      "flex-shrink": "0",
                      border: "none",
                      cursor: "pointer",
                      background: item.match(viewMode()) ? "var(--accent-color)" : "transparent",
                      color: item.match(viewMode()) ? "#fff" : "var(--text-secondary)",
                      "font-weight": item.match(viewMode()) ? "600" : "normal",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!item.match(viewMode())) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                    onMouseLeave={(e) => { if (!item.match(viewMode())) e.currentTarget.style.background = "transparent"; }}
                  >
                    {t(item.key)}
                  </button>
                )}
              </For>
            </div>

            {/* Vault lock button — always pinned right, separated */}
            <button
              onClick={() => setViewMode("passwords" as any)}
              class={`vault-tab-btn ${viewMode() === "passwords" ? "vault-tab-btn--active" : ""}`}
              title="Coffre-fort"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3" />
                <path d="M4.5 6V4.5C4.5 3.12 5.62 2 7 2C8.38 2 9.5 3.12 9.5 4.5V6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                <circle cx="7" cy="10" r="1" fill="currentColor" />
              </svg>
            </button>
          </header>

          {/* Calendar sub-bar */}
          <Show when={["month", "week", "day"].includes(viewMode())}>
            <div style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "0 16px",
              height: "32px",
              "border-bottom": "1px solid var(--border-color)",
              "flex-shrink": "0",
              background: "var(--bg-surface)",
            }}>
              <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <Button variant="ghost" size="sm" onClick={navigatePrev}>&lt;</Button>
                <span style={{ "font-size": "14px", "font-weight": "600", "text-transform": "capitalize", "min-width": "160px", "text-align": "center" }}>
                  {headerTitle()}
                </span>
                <Button variant="ghost" size="sm" onClick={navigateNext}>&gt;</Button>
                <Button variant="secondary" size="sm" onClick={goToToday}>Aujourd'hui</Button>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAiGenerator(true)} title="Generer des evenements avec l'IA">IA</Button>
                <Button variant={viewMode() === "month" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("month")}>Mois</Button>
                <Button variant={viewMode() === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>Semaine</Button>
                <Button variant={viewMode() === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>Jour</Button>
              </div>
            </div>
          </Show>

          {/* Content */}
          <div style={{ flex: "1", overflow: "hidden" }}>
            {props.children}
          </div>
        </main>

        <TaskDetail />
      </div>
    </div>
  );
}
