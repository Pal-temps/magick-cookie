import { createSignal, Show, For, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";

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
            {gitInfo()!.status.length} fichier{gitInfo()!.status.length > 1 ? "s" : ""} modifie{gitInfo()!.status.length > 1 ? "s" : ""}
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ─── Tasks Section ───

function TasksSection() {
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
        <div class="cc-ctx-muted">Les taches apparaitront ici quand l'agent travaille</div>
      }>
        <div class="cc-ctx-tasks__summary">
          {completedTools()}/{toolMessages().length} operations terminees
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
  const ai = useAiSessionStore();

  const msgCount = () => ai.activeSession()?.messages.length ?? 0;
  const model = () => ai.activeSession()?.model ?? "—";
  const phase = () => ai.activeSession()?.phase ?? "—";

  return (
    <div class="cc-ctx-session">
      <div class="cc-ctx-row">
        <span class="cc-ctx-label">Modele</span>
        <span class="cc-ctx-value">{model()}</span>
      </div>
      <div class="cc-ctx-row">
        <span class="cc-ctx-label">Statut</span>
        <span class={`cc-ctx-value cc-ctx-value--${phase()}`}>{phase()}</span>
      </div>
      <div class="cc-ctx-row">
        <span class="cc-ctx-label">Messages</span>
        <span class="cc-ctx-value">{msgCount()}</span>
      </div>
    </div>
  );
}

// ─── Main Context Panel ───

export function ContextPanel(props: ContextPanelProps) {
  function handleClose() {
    props.onClose?.();
  }

  return (
    <aside class="cc-context-panel">
      <div class="cc-context-panel__header">
        <span>Context</span>
        <button class="cc-context-panel__close" onClick={handleClose} title="Fermer (Ctrl+\)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="cc-context-panel__body">
        <Show when={props.projectPath}>
          <Section id="project" title="PROJECT" icon="&#x1F4C1;" badge="1">
            <ProjectSection projectPath={props.projectPath!} />
          </Section>
        </Show>

        <Section id="session" title="SESSION">
          <SessionSection />
        </Section>

        <Show when={props.projectPath}>
          <Section id="git" title="GIT BRANCH">
            <GitBranchSection projectPath={props.projectPath!} />
          </Section>
        </Show>

        <Section id="tasks" title="TASKS">
          <TasksSection />
        </Section>
      </div>
    </aside>
  );
}
