import { createSignal, Show, For, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useT } from "../../../i18n/context";

interface ContextPanelProps {
  projectPath: string | null;
  onClose?: () => void;
}

// ─── Collapsible Section ───

function Section(props: { id: string; title: string; icon?: string; badge?: string; children: any }) {
  const storageKey = `cc-section-${props.id}`;
  const [open, setOpen] = createSignal(localStorage.getItem(storageKey) !== "false");

  function toggle() {
    const next = !open();
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  }

  return (
    <div class="cc-ctx-section">
      <button class="cc-ctx-section__header" onClick={toggle}>
        <span class={`cc-ctx-section__chevron ${open() ? "cc-ctx-section__chevron--open" : ""}`}>&#x25B8;</span>
        <span class="cc-ctx-section__title">{props.title}</span>
        <Show when={props.badge}>
          <span class="cc-ctx-section__badge">{props.badge}</span>
        </Show>
      </button>
      <div class={`cc-ctx-section__body ${open() ? "cc-ctx-section__body--open" : ""}`}>
        <div class="cc-ctx-section__inner">
          {props.children}
        </div>
      </div>
    </div>
  );
}

// ─── Git Branch Section ───

interface GitInfo {
  branch: string;
  status: { path: string; status: string }[];
}

function GitBranchSection(props: { projectPath: string }) {
  const { t } = useT();
  const [gitInfo, setGitInfo] = createSignal<GitInfo | null>(null);

  onMount(async () => {
    try {
      const isRepo = await invoke<boolean>("git_is_repo", { path: props.projectPath });
      if (!isRepo) return;

      const branches = await invoke<{ name: string; is_current: boolean; is_remote: boolean }[]>(
        "git_branches", { path: props.projectPath }
      );
      const current = branches.find((b) => b.is_current);

      const status = await invoke<{ path: string; status: string }[]>(
        "git_status", { path: props.projectPath }
      );

      setGitInfo({
        branch: current?.name ?? "detached",
        status,
      });
    } catch { /* not a repo */ }
  });

  return (
    <Show when={gitInfo()}>
      <div class="cc-ctx-git">
        <div class="cc-ctx-git__branch">
          <span class="cc-ctx-git__icon">&#x2387;</span>
          <span>{gitInfo()!.branch}</span>
        </div>
        <Show when={gitInfo()!.status.length > 0}>
          <div class="cc-ctx-git__changes">
            {gitInfo()!.status.length} {t("ide.filesModified")}
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ─── Tasks Section ───

function TasksSection() {
  const { t } = useT();
  const ai = useAiSessionStore();

  const toolMessages = () => {
    const session = ai.activeSession();
    if (!session) return [];
    return session.messages.filter((m) => m.type === "tool_use");
  };

  const completedTools = () => {
    const session = ai.activeSession();
    if (!session) return 0;
    return session.messages.filter((m) => m.type === "tool_result").length;
  };

  return (
    <div class="cc-ctx-tasks">
      <Show when={toolMessages().length > 0} fallback={
        <div class="cc-ctx-muted">{t("ide.tasksPlaceholder")}</div>
      }>
        <div class="cc-ctx-tasks__summary">
          {completedTools()}/{toolMessages().length} {t("ide.operationsCompleted")}
        </div>
        <div class="cc-ctx-tasks__list">
          <For each={toolMessages().slice(-8)}>
            {(msg) => (
              <div class="cc-ctx-tasks__item">
                <span class="cc-ctx-tasks__dot" />
                <span class="cc-ctx-tasks__name">{msg.toolName ?? "Tool"}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ─── Project Section ───

function ProjectSection(props: { projectPath: string }) {
  const shortPath = () => {
    const parts = props.projectPath.replace(/\\/g, "/").split("/");
    return parts.slice(-2).join("/");
  };

  return (
    <div class="cc-ctx-project">
      <div class="cc-ctx-project__path" title={props.projectPath}>
        {shortPath()}
      </div>
    </div>
  );
}

// ─── Session Info Section ───

function SessionSection() {
  const { t } = useT();
  const ai = useAiSessionStore();

  const msgCount = () => ai.activeSession()?.messages.length ?? 0;
  const model = () => ai.activeSession()?.model ?? "—";
  const phase = () => ai.activeSession()?.phase ?? "—";

  return (
    <div class="cc-ctx-session">
      <div class="cc-ctx-row">
        <span class="cc-ctx-label">{t("ide.model")}</span>
        <span class="cc-ctx-value">{model()}</span>
      </div>
      <div class="cc-ctx-row">
        <span class="cc-ctx-label">{t("ide.status")}</span>
        <span class={`cc-ctx-value cc-ctx-value--${phase()}`}>{phase()}</span>
      </div>
      <div class="cc-ctx-row">
        <span class="cc-ctx-label">{t("ide.messages")}</span>
        <span class="cc-ctx-value">{msgCount()}</span>
      </div>
    </div>
  );
}

// ─── Session History Section ───

function SessionHistorySection() {
  const { t } = useT();
  const ai = useAiSessionStore();
  const ide = useIdeStore();
  const [loaded, setLoaded] = createSignal(false);

  async function load() {
    if (!loaded()) {
      await ai.fetchPastSessions();
      setLoaded(true);
    }
  }

  function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function handleResume(sessionId: string, provider: string, model: string) {
    const cwd = ide.projectPath() ?? ".";
    await ai.startSession({
      provider,
      model,
      cwd,
      resume_session_id: sessionId,
    });
  }

  return (
    <div class="cc-ctx-history">
      <Show when={!loaded()}>
        <button
          class="cc-ctx-history__load"
          onClick={load}
          style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", "font-size": "11px", padding: "4px 0" }}
        >
          {t("ide.loadSession")}
        </button>
      </Show>
      <Show when={loaded()}>
        <Show when={ai.pastSessions().length > 0} fallback={
          <div class="cc-ctx-muted">{t("ide.noSessionHistory")}</div>
        }>
          <div class="cc-ctx-tasks__list">
            <For each={ai.pastSessions().slice(0, 20)}>
              {(s) => (
                <div
                  class="cc-ctx-history__item"
                  title={`${s.provider} — ${s.model} — ${s.event_count} ${t("ide.eventCount")}`}
                >
                  <button
                    class="cc-ctx-history__view"
                    onClick={() => ai.loadPastSession(s.session_id)}
                  >
                    <span class="cc-ctx-tasks__dot" />
                    <span class="cc-ctx-history__label">
                      {s.label || s.model || s.provider}
                    </span>
                    <span class="cc-ctx-history__date">
                      {formatDate(s.started_at)}
                    </span>
                  </button>
                  <Show when={s.provider === "claude-cli"}>
                    <button
                      class="cc-ctx-history__resume"
                      onClick={() => handleResume(s.session_id, s.provider, s.model)}
                      title={t("ide.resumeSession")}
                    >
                      &#x25B6;
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

// ─── Main Context Panel ───

export function ContextPanel(props: ContextPanelProps) {
  const { t } = useT();
  function handleClose() {
    props.onClose?.();
  }

  return (
    <aside class="cc-context-panel">
      <div class="cc-context-panel__header">
        <span>{t("ide.context")}</span>
        <button class="cc-context-panel__close" onClick={handleClose} title={`${t("common.close")} (Ctrl+\\)`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="cc-context-panel__body">
        <Show when={props.projectPath}>
          <Section id="project" title={t("ide.project")} icon="&#x1F4C1;" badge="1">
            <ProjectSection projectPath={props.projectPath!} />
          </Section>
        </Show>

        <Section id="session" title={t("ide.session")}>
          <SessionSection />
        </Section>

        <Show when={props.projectPath}>
          <Section id="git" title={t("ide.gitBranch")}>
            <GitBranchSection projectPath={props.projectPath!} />
          </Section>
        </Show>

        <Section id="tasks" title={t("ide.tasks")}>
          <TasksSection />
        </Section>

        <Section id="history" title={t("ide.sessionHistory")}>
          <SessionHistorySection />
        </Section>
      </div>
    </aside>
  );
}
