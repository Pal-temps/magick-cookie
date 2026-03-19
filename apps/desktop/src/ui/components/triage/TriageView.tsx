import { onMount, Show, For, createMemo, createSignal } from "solid-js";
import { useTriageStore, type TriageStatus, type TriageSuggestion } from "../../../application/stores/triageStore";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useViewStore } from "../../../application/stores/viewStore";
import type { Task, TaskSource } from "../../../domain/models/Task";
import { SwipeCard } from "./SwipeCard";
import { Button } from "../common/Button";
import { openUrl } from "@tauri-apps/plugin-opener";

// --- Module-level drag state (ephemeral, no persistence needed) ---
const [activeDrag, setActiveDrag] = createSignal<{ id: string; name: string } | null>(null);
const [ghostPos, setGhostPos] = createSignal({ x: 0, y: 0 });
const [dropTarget, setDropTarget] = createSignal<TriageStatus | "untriaged" | null>(null);

// --- View mode toggle ---
const [viewType, setViewType] = createSignal<"triage" | "kanban">("kanban");

export function TriageView() {
  const triage = useTriageStore();
  const store = useTaskStore();
  const { tasks: unscheduledTasks, fetchUnscheduledTasks, fetchConnectorConfigs, syncConnector, isSyncing, openTaskDetail, sourceFilter, setSourceFilter, isConnectorConfigured } = store;

  onMount(async () => {
    await Promise.all([
      triage.fetchTriage(),
      fetchConnectorConfigs(),
    ]);
    if (unscheduledTasks().length === 0) {
      await fetchUnscheduledTasks();
    }
  });

  // Filter tasks by active source tab
  const filteredTasks = createMemo(() => {
    const src = sourceFilter();
    if (src === "all") return unscheduledTasks();
    return unscheduledTasks().filter((t) => t.source === src);
  });

  const priorityTasks = createMemo(() => triage.getTasksByStatus("priority", filteredTasks()));
  const laterTasks = createMemo(() => triage.getTasksByStatus("later", filteredTasks()));
  const archivedTasks = createMemo(() => triage.getTasksByStatus("archived", filteredTasks()));
  const untriagedTasks = createMemo(() => triage.getUntriagedTasks(filteredTasks()));

  function handleStartTriage() {
    triage.startTriage(filteredTasks());
  }

  async function handleFinish() {
    await triage.finishTriage();
  }

  function handleKeyboard(e: KeyboardEvent) {
    if (!triage.isTriaging()) return;
    switch (e.key) {
      case "ArrowRight": triage.swipe("priority"); break;
      case "ArrowLeft": triage.swipe("later"); break;
      case "ArrowUp": e.preventDefault(); triage.swipe("archived"); break;
      case "ArrowDown": e.preventDefault(); triage.swipe("dismissed"); break;
      case "z": if (e.ctrlKey) triage.undoLast(); break;
    }
  }

  function handleMoveTask(taskId: string, newStatus: TriageStatus | "untriaged") {
    if (newStatus === "untriaged") {
      triage.untriagedMove(taskId);
    } else {
      triage.moveTask(taskId, newStatus);
    }
  }

  function handleSourceChange(src: TaskSource | "all") {
    setSourceFilter(src);
    fetchUnscheduledTasks();
  }

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }} tabIndex={0} onKeyDown={handleKeyboard}>
      <Show when={triage.isTriaging()} fallback={
        <Show when={viewType() === "kanban"} fallback={
          <TriageDashboard
            priorityTasks={priorityTasks()}
            laterTasks={laterTasks()}
            archivedTasks={archivedTasks()}
            untriagedTasks={untriagedTasks()}
            totalCount={filteredTasks().length}
            onStartTriage={handleStartTriage}
            onSync={syncConnector}
            isSyncing={isSyncing()}
            onClickTask={openTaskDetail}
            onMoveTask={(id, status) => triage.moveTask(id, status)}
            sourceFilter={sourceFilter()}
            onSourceFilterChange={handleSourceChange}
            isConfigured={isConnectorConfigured(sourceFilter())}
          />
        }>
          <KanbanBoard
            priorityTasks={priorityTasks()}
            laterTasks={laterTasks()}
            archivedTasks={archivedTasks()}
            untriagedTasks={untriagedTasks()}
            totalCount={filteredTasks().length}
            onStartTriage={handleStartTriage}
            onSync={syncConnector}
            isSyncing={isSyncing()}
            onClickTask={openTaskDetail}
            onMoveTask={handleMoveTask}
            sourceFilter={sourceFilter()}
            onSourceFilterChange={handleSourceChange}
            isConfigured={isConnectorConfigured(sourceFilter())}
          />
        </Show>
      }>
        <div style={{
          flex: "1",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          position: "relative",
        }}>
          {/* Header */}
          <div style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            right: "16px",
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
          }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
              <Button size="sm" variant="ghost" onClick={() => triage.stopTriage()}>
                &#8592; Retour
              </Button>
              <span style={{ "font-size": "13px", color: "var(--text-secondary)" }}>
                {triage.remainingCount()} tache(s) restante(s)
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button size="sm" variant="ghost" onClick={() => triage.undoLast()} disabled={triage.pendingDecisions().length === 0}>
                Annuler (Ctrl+Z)
              </Button>
              <Button size="sm" variant="primary" onClick={handleFinish} disabled={triage.isSaving()}>
                {triage.isSaving() ? "..." : `Terminer (${triage.pendingDecisions().length})`}
              </Button>
            </div>
          </div>

          {/* Card area */}
          <Show when={triage.currentTask()} fallback={
            <div style={{ "text-align": "center" }}>
              <div style={{ "font-size": "48px", "margin-bottom": "16px" }}>&#10003;</div>
              <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)", "margin-bottom": "8px" }}>
                Triage termine !
              </h2>
              <p style={{ "font-size": "13px", color: "var(--text-muted)", "margin-bottom": "20px" }}>
                {triage.pendingDecisions().length} decision(s) a sauvegarder
              </p>
              <div style={{ display: "flex", gap: "8px", "justify-content": "center" }}>
                <Button variant="primary" onClick={handleFinish} disabled={triage.isSaving()}>
                  {triage.isSaving() ? "Sauvegarde..." : "Sauvegarder et quitter"}
                </Button>
                <Button variant="ghost" onClick={() => triage.stopTriage()}>
                  Annuler
                </Button>
              </div>
            </div>
          }>
            <SwipeCard
              task={triage.currentTask()!}
              onSwipe={(status) => triage.swipe(status)}
            />
          </Show>

          {/* Direction hints */}
          <Show when={triage.currentTask()}>
            <div style={{
              position: "absolute",
              bottom: "24px",
              "font-size": "11px",
              color: "var(--text-muted)",
              "text-align": "center",
            }}>
              Glissez la carte ou utilisez les fleches du clavier
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// --- View toggle (like calendar Month/Week/Day) ---

function ViewToggle() {
  const modes: Array<{ key: "triage" | "kanban"; label: string }> = [
    { key: "kanban", label: "Kanban" },
    { key: "triage", label: "Triage" },
  ];

  return (
    <div style={{ display: "flex", gap: "4px" }}>
      <For each={modes}>
        {(mode) => (
          <Button
            variant={viewType() === mode.key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewType(mode.key)}
          >
            {mode.label}
          </Button>
        )}
      </For>
    </div>
  );
}

// --- Source Tabs ---

const SOURCE_TABS: { key: TaskSource | "all"; label: string; icon: string }[] = [
  { key: "all", label: "Tout", icon: "" },
  { key: "clickup", label: "ClickUp", icon: "\u{1F4CB}" },
  { key: "github", label: "GitHub", icon: "\u{1F419}" },
  { key: "gitlab", label: "GitLab", icon: "\u{1F98A}" },
  { key: "manual", label: "Manuel", icon: "\u{270F}" },
];

function SourceTabs(props: { active: TaskSource | "all"; onChange: (key: TaskSource | "all") => void }) {
  return (
    <div style={{
      display: "flex",
      gap: "0",
      padding: "0 20px",
      "flex-shrink": "0",
      "border-bottom": "1px solid var(--border-color)",
    }}>
      <For each={SOURCE_TABS}>
        {(tab) => (
          <button
            onClick={() => props.onChange(tab.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              "border-bottom": props.active === tab.key ? "2px solid var(--accent-primary)" : "2px solid transparent",
              background: "transparent",
              color: props.active === tab.key ? "var(--text-primary)" : "var(--text-muted)",
              "font-size": "12px",
              "font-weight": props.active === tab.key ? "600" : "400",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
              display: "flex",
              "align-items": "center",
              gap: "5px",
            }}
          >
            <Show when={tab.icon}><span>{tab.icon}</span></Show>
            {tab.label}
          </button>
        )}
      </For>
    </div>
  );
}

// --- Connector Setup Guide (shown when connector is not configured) ---

interface SetupStep {
  text: string;
  action?: { label: string; url?: string; goSettings?: boolean };
}

interface ConnectorSetupInfo {
  title: string;
  description: string;
  steps: SetupStep[];
}

const CONNECTOR_SETUP: Record<string, ConnectorSetupInfo> = {
  clickup: {
    title: "Configurer ClickUp",
    description: "Synchronisez vos taches ClickUp pour les voir dans le kanban.",
    steps: [
      {
        text: "Generez un token API personnel sur ClickUp",
        action: { label: "Ouvrir ClickUp Apps", url: "https://app.clickup.com/settings/apps" },
      },
      {
        text: "Configurez le connecteur dans les parametres",
        action: { label: "Ouvrir Parametres", goSettings: true },
      },
      { text: "Renseignez votre token et sauvegardez" },
      { text: "Revenez ici et cliquez sur Sync" },
    ],
  },
  github: {
    title: "Configurer GitHub",
    description: "Synchronisez vos Issues et Pull Requests GitHub.",
    steps: [
      {
        text: "Creez un Personal Access Token (permissions : repo read)",
        action: { label: "Ouvrir GitHub Tokens", url: "https://github.com/settings/tokens/new?scopes=repo&description=magick-cookie" },
      },
      {
        text: "Configurez le connecteur dans les parametres",
        action: { label: "Ouvrir Parametres", goSettings: true },
      },
      { text: "Renseignez votre token, nom d'utilisateur et les repos a surveiller" },
      { text: "Activez la synchronisation des Issues et/ou Pull Requests" },
      { text: "Revenez ici et cliquez sur Sync" },
    ],
  },
  gitlab: {
    title: "Configurer GitLab",
    description: "Synchronisez vos Issues GitLab avec detection automatique des colonnes de board.",
    steps: [
      {
        text: "Creez un Personal Access Token (scope : read_api)",
        action: { label: "Ouvrir GitLab Tokens", url: "https://gitlab.com/-/user_settings/personal_access_tokens" },
      },
      {
        text: "Configurez le connecteur dans les parametres",
        action: { label: "Ouvrir Parametres", goSettings: true },
      },
      { text: "Renseignez votre token, l'URL de base et les IDs de projets" },
      {
        text: "L'ID du projet se trouve dans Settings > General sur GitLab",
      },
      { text: "Revenez ici et cliquez sur Sync" },
    ],
  },
};

const stepNumberStyle = {
  width: "22px",
  height: "22px",
  "border-radius": "50%",
  background: "var(--accent-primary)",
  color: "var(--accent-primary-text, #fff)",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  "font-size": "11px",
  "font-weight": "700",
  "flex-shrink": "0",
};

const stepActionBtnStyle = {
  padding: "4px 10px",
  "border-radius": "var(--radius-sm)",
  border: "1px solid var(--border-color)",
  background: "var(--bg-elevated)",
  color: "var(--accent-primary)",
  "font-size": "11px",
  "font-weight": "500",
  cursor: "pointer",
  "white-space": "nowrap" as const,
  "flex-shrink": "0",
  display: "inline-flex",
  "align-items": "center",
  gap: "4px",
};

function ConnectorSetupGuide(props: { source: TaskSource }) {
  const { setViewMode } = useViewStore();
  const setup = () => CONNECTOR_SETUP[props.source];

  function handleAction(action: NonNullable<SetupStep["action"]>) {
    if (action.url) {
      openUrl(action.url);
    } else if (action.goSettings) {
      setViewMode("settings");
    }
  }

  return (
    <Show when={setup()} fallback={
      <div style={{ padding: "60px 20px", "text-align": "center" }}>
        <div style={{ "font-size": "32px", "margin-bottom": "12px" }}>{"\u{270F}"}</div>
        <h3 style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", margin: "0 0 8px" }}>
          Taches manuelles
        </h3>
        <p style={{ "font-size": "13px", color: "var(--text-muted)", "max-width": "400px", margin: "0 auto" }}>
          Les taches manuelles sont creees directement dans l'application. Aucune configuration requise.
        </p>
      </div>
    }>
      {(s) => (
        <div style={{
          padding: "48px 20px",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          flex: "1",
        }}>
          <div style={{
            "max-width": "500px",
            width: "100%",
            background: "var(--bg-surface)",
            "border-radius": "var(--radius-md)",
            border: "1px solid var(--border-color)",
            padding: "28px 32px",
          }}>
            <div style={{ "font-size": "28px", "margin-bottom": "12px", "text-align": "center" }}>
              {SOURCE_TABS.find((t) => t.key === props.source)?.icon || "\u{1F50C}"}
            </div>
            <h3 style={{
              "font-size": "17px",
              "font-weight": "600",
              color: "var(--text-primary)",
              margin: "0 0 6px",
              "text-align": "center",
            }}>
              {s().title}
            </h3>
            <p style={{
              "font-size": "13px",
              color: "var(--text-muted)",
              margin: "0 0 24px",
              "text-align": "center",
              "line-height": "1.5",
            }}>
              {s().description}
            </p>

            <div style={{
              display: "flex",
              "flex-direction": "column",
              gap: "14px",
            }}>
              <For each={s().steps}>
                {(step, i) => (
                  <div style={{
                    display: "flex",
                    "align-items": "flex-start",
                    gap: "12px",
                  }}>
                    <div style={stepNumberStyle}>{i() + 1}</div>
                    <div style={{ flex: "1", "min-width": "0" }}>
                      <div style={{
                        "font-size": "13px",
                        color: "var(--text-secondary)",
                        "line-height": "1.5",
                        "margin-bottom": step.action ? "6px" : "0",
                      }}>
                        {step.text}
                      </div>
                      <Show when={step.action}>
                        {(action) => (
                          <button
                            onClick={() => handleAction(action())}
                            style={stepActionBtnStyle}
                          >
                            {action().url ? "\u{2197}" : "\u{2699}"} {action().label}
                          </button>
                        )}
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}

// --- Kanban Board ---

interface KanbanBoardProps {
  priorityTasks: Task[];
  laterTasks: Task[];
  archivedTasks: Task[];
  untriagedTasks: Task[];
  totalCount: number;
  onStartTriage: () => void;
  onSync: (source?: string) => void;
  isSyncing: boolean;
  onClickTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus | "untriaged") => void;
  sourceFilter: TaskSource | "all";
  onSourceFilterChange: (source: TaskSource | "all") => void;
  isConfigured: boolean;
}

function KanbanBoard(props: KanbanBoardProps) {
  const triage = useTriageStore();

  async function handleAutoTriage() {
    await triage.fetchSuggestions();
  }

  async function applySuggestion(suggestion: TriageSuggestion) {
    await triage.moveTask(suggestion.taskId, suggestion.suggestedStatus);
    triage.clearSuggestions();
  }

  async function applyAllSuggestions() {
    const items = triage.suggestions().map(s => ({
      taskId: s.taskId,
      triageStatus: s.suggestedStatus as TriageStatus,
    }));
    for (const item of items) {
      await triage.moveTask(item.taskId, item.triageStatus);
    }
    triage.clearSuggestions();
  }

  const statusColors: Record<string, string> = {
    priority: "#ef4444",
    later: "#3b82f6",
    archived: "#8b5cf6",
  };

  const statusLabels: Record<string, string> = {
    priority: "Prioritaire",
    later: "Plus tard",
    archived: "Archive",
  };

  const syncLabel = () => {
    const src = props.sourceFilter;
    if (src === "all") return "Sync All";
    if (src === "manual") return "Sync";
    return `Sync ${SOURCE_TABS.find(t => t.key === src)?.label || ""}`;
  };

  function handleSync() {
    const src = props.sourceFilter;
    if (src === "all") {
      // Sync all configured connectors sequentially
      props.onSync("clickup");
    } else if (src !== "manual") {
      props.onSync(src);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Drag ghost */}
      <Show when={activeDrag()}>
        <div
          id="triage-ghost"
          style={{
            position: "fixed",
            left: ghostPos().x + "px",
            top: ghostPos().y + "px",
            transform: "translate(-50%, -50%) rotate(2deg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-color)",
            "border-radius": "var(--radius-sm)",
            padding: "6px 12px",
            "font-size": "12px",
            color: "var(--text-primary)",
            "pointer-events": "none",
            "z-index": "9999",
            "box-shadow": "0 4px 16px rgba(0,0,0,0.3)",
            "max-width": "200px",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            opacity: "0.95",
          }}
        >
          {activeDrag()!.name}
        </div>
      </Show>

      {/* Source filter tabs */}
      <SourceTabs active={props.sourceFilter} onChange={props.onSourceFilterChange} />

      {/* Show setup guide if connector not configured */}
      <Show when={!props.isConfigured && props.sourceFilter !== "all"}>
        <ConnectorSetupGuide source={props.sourceFilter as TaskSource} />
      </Show>

      {/* Show kanban when configured (or "all" tab) */}
      <Show when={props.isConfigured || props.sourceFilter === "all"}>
        {/* Header bar */}
        <div style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "16px 20px 12px",
          "flex-shrink": "0",
        }}>
          <div>
            <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>Triage des taches</h2>
            <p style={{ "font-size": "12px", color: "var(--text-muted)", "margin-top": "4px", margin: "4px 0 0 0" }}>
              {props.totalCount} tache(s) au total — {props.untriagedTasks.length} non triee(s)
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <ViewToggle />
            <Button size="sm" variant="secondary" onClick={handleAutoTriage} disabled={triage.suggestLoading()}>
              {triage.suggestLoading() ? "Analyse..." : "Auto-triage (IA)"}
            </Button>
            <Show when={props.sourceFilter !== "manual"}>
              <Button size="sm" variant="secondary" onClick={handleSync} disabled={props.isSyncing}>
                {props.isSyncing ? "..." : syncLabel()}
              </Button>
            </Show>
            <Button size="sm" variant="primary" onClick={props.onStartTriage}>
              Trier &#10022; {props.untriagedTasks.length}
            </Button>
          </div>
        </div>

        {/* Suggestions panel */}
        <Show when={triage.suggestLoading()}>
          <div style={{
            background: "var(--bg-elevated)",
            "border-radius": "var(--radius-md)",
            border: "1px solid var(--border-color)",
            padding: "16px",
            margin: "0 20px 12px",
            "text-align": "center",
          }}>
            <div style={{ "font-size": "14px", color: "var(--text-secondary)" }}>
              L'IA analyse vos taches...
            </div>
          </div>
        </Show>

        <Show when={!triage.suggestLoading() && triage.suggestions().length > 0}>
          <div style={{
            background: "var(--bg-elevated)",
            "border-radius": "var(--radius-md)",
            border: "1px solid var(--accent-primary)",
            padding: "16px",
            margin: "0 20px 12px",
          }}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "12px" }}>
              <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                Suggestions de l'IA ({triage.suggestions().length})
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <Button size="sm" variant="primary" onClick={applyAllSuggestions}>
                  Appliquer tout
                </Button>
                <Button size="sm" variant="ghost" onClick={() => triage.clearSuggestions()}>
                  Ignorer
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
              <For each={triage.suggestions()}>
                {(suggestion) => (
                  <div style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "10px",
                    padding: "8px 12px",
                    background: "var(--bg-surface)",
                    "border-radius": "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                  }}>
                    <div style={{ flex: "1", "min-width": "0" }}>
                      <div style={{
                        "font-size": "12px",
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}>
                        {suggestion.taskTitle}
                      </div>
                      <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>
                        {suggestion.reason}
                      </div>
                    </div>
                    <span style={{
                      "font-size": "10px",
                      padding: "2px 8px",
                      "border-radius": "var(--radius-sm)",
                      background: statusColors[suggestion.suggestedStatus] || "var(--bg-elevated)",
                      color: "#fff",
                      "white-space": "nowrap",
                      "flex-shrink": "0",
                    }}>
                      {statusLabels[suggestion.suggestedStatus] || suggestion.suggestedStatus}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => applySuggestion(suggestion)}>
                      Appliquer
                    </Button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* 4-column Kanban board */}
        <div style={{
          flex: "1",
          display: "grid",
          "grid-template-columns": "1fr 1fr 1fr 1fr",
          gap: "12px",
          padding: "0 20px 20px",
          "min-height": "0",
          overflow: "hidden",
        }}>
          <KanbanColumn
            title="Non trie"
            status="untriaged"
            color="#6b7280"
            tasks={props.untriagedTasks}
            onClickTask={props.onClickTask}
            onMoveTask={props.onMoveTask}
          />
          <KanbanColumn
            title="Prioritaire"
            status="priority"
            color="#ef4444"
            tasks={props.priorityTasks}
            onClickTask={props.onClickTask}
            onMoveTask={props.onMoveTask}
          />
          <KanbanColumn
            title="Plus tard"
            status="later"
            color="#3b82f6"
            tasks={props.laterTasks}
            onClickTask={props.onClickTask}
            onMoveTask={props.onMoveTask}
          />
          <KanbanColumn
            title="Archive"
            status="archived"
            color="#8b5cf6"
            tasks={props.archivedTasks}
            onClickTask={props.onClickTask}
            onMoveTask={props.onMoveTask}
          />
        </div>
      </Show>
    </div>
  );
}

// --- Kanban Column ---

interface KanbanColumnProps {
  title: string;
  status: TriageStatus | "untriaged";
  color: string;
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus | "untriaged") => void;
}

function KanbanColumn(props: KanbanColumnProps) {
  const isDropTarget = () => activeDrag() !== null && dropTarget() === props.status;

  return (
    <div
      data-triage-status={props.status}
      style={{
        display: "flex",
        "flex-direction": "column",
        background: isDropTarget() ? `${props.color}15` : "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: `2px ${isDropTarget() ? "dashed" : "solid"} ${isDropTarget() ? props.color : "var(--border-color)"}`,
        overflow: "hidden",
        transition: "background 0.15s, border-color 0.15s",
        "min-height": "0",
      }}
    >
      {/* Column header with colored top border */}
      <div style={{
        padding: "10px 14px",
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "border-top": `3px solid ${props.color}`,
        "border-bottom": "1px solid var(--border-color)",
        "flex-shrink": "0",
      }}>
        <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>
          {props.title}
        </span>
        <span style={{
          "font-size": "11px",
          padding: "1px 8px",
          "border-radius": "var(--radius-sm)",
          background: props.color,
          color: "#fff",
        }}>
          {props.tasks.length}
        </span>
      </div>

      {/* Scrollable card list */}
      <div style={{ flex: "1", "overflow-y": "auto", padding: "6px" }}>
        <For each={props.tasks}>
          {(task) => (
            <KanbanCard task={task} onMoveTask={props.onMoveTask} onClick={() => props.onClickTask(task)} />
          )}
        </For>
        <Show when={props.tasks.length === 0}>
          <div style={{
            padding: "24px 12px",
            "text-align": "center",
            "font-size": "11px",
            color: isDropTarget() ? props.color : "var(--text-muted)",
            transition: "color 0.15s",
          }}>
            {isDropTarget() ? "Deposer ici" : "Aucune tache"}
          </div>
        </Show>
      </div>
    </div>
  );
}

// --- Kanban Card ---

const sourceIcons: Record<string, string> = {
  clickup: "\u{1F4CB}",
  manual: "\u{270F}",
  github: "\u{1F419}",
  gitlab: "\u{1F98A}",
};

const priorityColors: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#6b7280",
};

interface KanbanCardProps {
  task: Task;
  onClick: () => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus | "untriaged") => void;
}

function KanbanCard(props: KanbanCardProps) {
  const isDragging = () => activeDrag()?.id === props.task.id;

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();

    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);

    setActiveDrag({ id: props.task.id, name: props.task.title });
    setGhostPos({ x: e.clientX, y: e.clientY });
    setDropTarget(null);

    function onMove(ev: PointerEvent) {
      setGhostPos({ x: ev.clientX, y: ev.clientY });
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = under?.closest("[data-triage-status]") as HTMLElement | null;
      setDropTarget((col?.dataset.triageStatus as TriageStatus | "untriaged") ?? null);
    }

    function cleanup() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      try { el.releasePointerCapture(pointerId); } catch {}

      const status = dropTarget();
      setActiveDrag(null);
      setDropTarget(null);

      if (status) {
        props.onMoveTask(props.task.id, status);
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }

  function handleClick(e: MouseEvent) {
    if (!activeDrag()) props.onClick();
  }

  const label = () => props.task.labels[0] ?? null;
  const prio = () => props.task.priority;

  return (
    <div
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{
        padding: "8px 10px",
        "margin-bottom": "6px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-color)",
        "border-radius": "var(--radius-sm)",
        cursor: isDragging() ? "grabbing" : "grab",
        transition: "opacity 0.1s, box-shadow 0.15s",
        opacity: isDragging() ? "0.3" : "1",
        "user-select": "none",
        "box-sizing": "border-box",
      }}
      onMouseEnter={(e) => { if (!isDragging()) e.currentTarget.style["box-shadow"] = "0 2px 8px rgba(0,0,0,0.15)"; }}
      onMouseLeave={(e) => { e.currentTarget.style["box-shadow"] = "none"; }}
    >
      {/* Title */}
      <div style={{
        "font-size": "12px",
        color: "var(--text-primary)",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
        "margin-bottom": "4px",
        "font-weight": "500",
      }}>
        {props.task.title}
      </div>

      {/* Meta row: label, priority, source */}
      <div style={{ display: "flex", "align-items": "center", gap: "6px", "flex-wrap": "wrap" }}>
        <Show when={label()}>
          <span style={{
            "font-size": "10px",
            padding: "1px 6px",
            "border-radius": "var(--radius-sm)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "max-width": "100px",
          }}>
            {label()}
          </span>
        </Show>
        <Show when={prio()}>
          <span style={{
            "font-size": "9px",
            padding: "1px 5px",
            "border-radius": "2px",
            background: priorityColors[prio()!] || "var(--bg-elevated)",
            color: "#fff",
            "text-transform": "capitalize",
            "white-space": "nowrap",
          }}>
            {prio()}
          </span>
        </Show>
        <span style={{
          "font-size": "10px",
          "margin-left": "auto",
          "flex-shrink": "0",
        }}>
          {sourceIcons[props.task.source] || ""}
        </span>
      </div>
    </div>
  );
}

// --- Legacy Dashboard (triage mode fallback) ---

interface TriageDashboardProps {
  priorityTasks: Task[];
  laterTasks: Task[];
  archivedTasks: Task[];
  untriagedTasks: Task[];
  totalCount: number;
  onStartTriage: () => void;
  onSync: (source?: string) => void;
  isSyncing: boolean;
  onClickTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
  sourceFilter: TaskSource | "all";
  onSourceFilterChange: (source: TaskSource | "all") => void;
  isConfigured: boolean;
}

function TriageDashboard(props: TriageDashboardProps) {
  const triage = useTriageStore();

  async function handleAutoTriage() {
    await triage.fetchSuggestions();
  }

  async function applySuggestion(suggestion: TriageSuggestion) {
    await triage.moveTask(suggestion.taskId, suggestion.suggestedStatus);
    triage.clearSuggestions();
  }

  async function applyAllSuggestions() {
    const items = triage.suggestions().map(s => ({
      taskId: s.taskId,
      triageStatus: s.suggestedStatus as TriageStatus,
    }));
    for (const item of items) {
      await triage.moveTask(item.taskId, item.triageStatus);
    }
    triage.clearSuggestions();
  }

  const statusColors: Record<string, string> = {
    priority: "#ef4444",
    later: "#3b82f6",
    archived: "#8b5cf6",
  };

  const statusLabels: Record<string, string> = {
    priority: "Prioritaire",
    later: "Plus tard",
    archived: "Archive",
  };

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Source filter tabs */}
      <SourceTabs active={props.sourceFilter} onChange={props.onSourceFilterChange} />

      {/* Show setup guide if connector not configured */}
      <Show when={!props.isConfigured && props.sourceFilter !== "all"}>
        <ConnectorSetupGuide source={props.sourceFilter as TaskSource} />
      </Show>

      <Show when={props.isConfigured || props.sourceFilter === "all"}>
        <div style={{ flex: "1", "overflow-y": "auto", padding: "20px", position: "relative" }}>
          {/* Drag ghost */}
          <Show when={activeDrag()}>
            <div
              id="triage-ghost"
              style={{
                position: "fixed",
                left: ghostPos().x + "px",
                top: ghostPos().y + "px",
                transform: "translate(-50%, -50%) rotate(2deg)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-color)",
                "border-radius": "var(--radius-sm)",
                padding: "6px 12px",
                "font-size": "12px",
                color: "var(--text-primary)",
                "pointer-events": "none",
                "z-index": "9999",
                "box-shadow": "0 4px 16px rgba(0,0,0,0.3)",
                "max-width": "200px",
                "white-space": "nowrap",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                opacity: "0.95",
              }}
            >
              {activeDrag()!.name}
            </div>
          </Show>

          {/* Header */}
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
            <div>
              <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>Triage des taches</h2>
              <p style={{ "font-size": "12px", color: "var(--text-muted)", "margin-top": "4px" }}>
                {props.totalCount} tache(s) au total — {props.untriagedTasks.length} non triee(s)
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
              <ViewToggle />
              <Button size="sm" variant="secondary" onClick={handleAutoTriage} disabled={triage.suggestLoading()}>
                {triage.suggestLoading() ? "Analyse en cours..." : "Auto-triage (IA)"}
              </Button>
              <Show when={props.sourceFilter !== "manual"}>
                <Button size="sm" variant="secondary" onClick={() => {
                  const src = props.sourceFilter;
                  if (src === "all") props.onSync("clickup");
                  else props.onSync(src);
                }} disabled={props.isSyncing}>
                  {props.isSyncing ? "..." : "Sync"}
                </Button>
              </Show>
            </div>
          </div>

          {/* Suggestions panel */}
          <Show when={triage.suggestLoading()}>
            <div style={{
              background: "var(--bg-elevated)",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              padding: "20px",
              "margin-bottom": "20px",
              "text-align": "center",
            }}>
              <div style={{ "font-size": "14px", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
                L'IA analyse vos taches...
              </div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                Cela peut prendre quelques secondes
              </div>
            </div>
          </Show>

          <Show when={!triage.suggestLoading() && triage.suggestions().length > 0}>
            <div style={{
              background: "var(--bg-elevated)",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--accent-primary)",
              padding: "16px",
              "margin-bottom": "20px",
            }}>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "12px" }}>
                <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                  Suggestions de l'IA ({triage.suggestions().length})
                </h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button size="sm" variant="primary" onClick={applyAllSuggestions}>
                    Appliquer tout
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => triage.clearSuggestions()}>
                    Ignorer
                  </Button>
                </div>
              </div>
              <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
                <For each={triage.suggestions()}>
                  {(suggestion) => (
                    <div style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "10px",
                      padding: "8px 12px",
                      background: "var(--bg-surface)",
                      "border-radius": "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                    }}>
                      <div style={{ flex: "1", "min-width": "0" }}>
                        <div style={{
                          "font-size": "12px",
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                        }}>
                          {suggestion.taskTitle}
                        </div>
                        <div style={{ "font-size": "10px", color: "var(--text-muted)", "margin-top": "2px" }}>
                          {suggestion.reason}
                        </div>
                      </div>
                      <span style={{
                        "font-size": "10px",
                        padding: "2px 8px",
                        "border-radius": "var(--radius-sm)",
                        background: statusColors[suggestion.suggestedStatus] || "var(--bg-elevated)",
                        color: "#fff",
                        "white-space": "nowrap",
                        "flex-shrink": "0",
                      }}>
                        {statusLabels[suggestion.suggestedStatus] || suggestion.suggestedStatus}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => applySuggestion(suggestion)}>
                        Appliquer
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Columns */}
          <div style={{ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "16px" }}>
            <TaskColumn
              title="Prioritaire"
              status="priority"
              color="#ef4444"
              tasks={props.priorityTasks}
              onClickTask={props.onClickTask}
              onMoveTask={props.onMoveTask}
            />
            <TaskColumn
              title="Plus tard"
              status="later"
              color="#3b82f6"
              tasks={props.laterTasks}
              onClickTask={props.onClickTask}
              onMoveTask={props.onMoveTask}
            />
            <TaskColumn
              title="Archive"
              status="archived"
              color="#8b5cf6"
              tasks={props.archivedTasks}
              onClickTask={props.onClickTask}
              onMoveTask={props.onMoveTask}
            />
          </div>

          {/* Untriaged section */}
          <Show when={props.untriagedTasks.length > 0}>
            <UntriagedSection
              tasks={props.untriagedTasks}
              onClickTask={props.onClickTask}
              onStartTriage={props.onStartTriage}
              onMoveTask={props.onMoveTask}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}

// --- Legacy Columns ---

interface TaskColumnProps {
  title: string;
  status: TriageStatus;
  color: string;
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
}

function TaskColumn(props: TaskColumnProps) {
  const isDropTarget = () => activeDrag() !== null && dropTarget() === props.status;

  return (
    <div
      data-triage-status={props.status}
      style={{
        background: isDropTarget() ? `${props.color}15` : "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: `2px ${isDropTarget() ? "dashed" : "solid"} ${isDropTarget() ? props.color : "var(--border-color)"}`,
        overflow: "hidden",
        transition: "background 0.15s, border-color 0.15s",
        "min-height": "120px",
      }}
    >
      <div style={{
        padding: "10px 14px",
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "border-bottom": "2px solid " + props.color,
      }}>
        <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>
          {props.title}
        </span>
        <span style={{
          "font-size": "11px",
          padding: "1px 8px",
          "border-radius": "var(--radius-sm)",
          background: props.color,
          color: "#fff",
        }}>
          {props.tasks.length}
        </span>
      </div>
      <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
        <For each={props.tasks}>
          {(task) => (
            <DraggableTaskItem task={task} onMoveTask={props.onMoveTask} onClick={() => props.onClickTask(task)} />
          )}
        </For>
        <Show when={props.tasks.length === 0}>
          <div style={{
            padding: "24px 16px",
            "text-align": "center",
            "font-size": "11px",
            color: isDropTarget() ? props.color : "var(--text-muted)",
            transition: "color 0.15s",
          }}>
            {isDropTarget() ? "Deposer ici" : "Aucune tache"}
          </div>
        </Show>
      </div>
    </div>
  );
}

// --- Untriaged section ---

interface UntriagedSectionProps {
  tasks: Task[];
  onClickTask: (task: Task) => void;
  onStartTriage: () => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
}

function UntriagedSection(props: UntriagedSectionProps) {
  const [isExpanded, setIsExpanded] = createSignal(true);

  return (
    <div style={{ "margin-top": "24px" }}>
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "margin-bottom": "12px",
      }}>
        <button
          onClick={() => setIsExpanded((v) => !v)}
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
            color: "var(--text-primary)",
          }}
        >
          <span style={{
            "font-size": "13px",
            "font-weight": "600",
            transition: "transform 0.15s",
            display: "inline-block",
            transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)",
          }}>&#9654;</span>
          <span style={{ "font-size": "14px", "font-weight": "600" }}>Non triees</span>
          <span style={{
            "font-size": "11px",
            padding: "1px 8px",
            "border-radius": "var(--radius-sm)",
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
          }}>
            {props.tasks.length}
          </span>
        </button>
        <Button size="sm" variant="primary" onClick={props.onStartTriage}>
          Trier (tinder) &#10022; {props.tasks.length}
        </Button>
      </div>

      <Show when={isExpanded()}>
        <div style={{
          display: "grid",
          "grid-template-columns": "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "8px",
        }}>
          <For each={props.tasks}>
            {(task) => (
              <DraggableTaskItem task={task} card onMoveTask={props.onMoveTask} onClick={() => props.onClickTask(task)} />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// --- Draggable item (pointer events, Tauri-safe) — used by legacy dashboard ---

interface DraggableTaskItemProps {
  task: Task;
  onClick: () => void;
  onMoveTask: (taskId: string, newStatus: TriageStatus) => void;
  card?: boolean;
}

function DraggableTaskItem(props: DraggableTaskItemProps) {
  const isDragging = () => activeDrag()?.id === props.task.id;

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();

    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);

    setActiveDrag({ id: props.task.id, name: props.task.title });
    setGhostPos({ x: e.clientX, y: e.clientY });
    setDropTarget(null);

    function onMove(ev: PointerEvent) {
      setGhostPos({ x: ev.clientX, y: ev.clientY });

      // Ghost has pointer-events:none so elementFromPoint sees through it
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = under?.closest("[data-triage-status]") as HTMLElement | null;
      setDropTarget((col?.dataset.triageStatus as TriageStatus) ?? null);
    }

    function cleanup() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      try { el.releasePointerCapture(pointerId); } catch {}

      const status = dropTarget();
      setActiveDrag(null);
      setDropTarget(null);

      if (status) {
        props.onMoveTask(props.task.id, status as TriageStatus);
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }

  function handleClick(e: MouseEvent) {
    // Only fire click if not dragging
    if (!activeDrag()) props.onClick();
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 14px",
        "text-align": "left",
        cursor: isDragging() ? "grabbing" : "grab",
        ...(props.card
          ? {
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)",
            }
          : { "border-bottom": "1px solid var(--border-color)" }),
        transition: "opacity 0.1s",
        opacity: isDragging() ? "0.3" : "1",
        "user-select": "none",
        "box-sizing": "border-box",
      }}
      onMouseEnter={(e) => { if (!isDragging()) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = props.card ? "var(--bg-surface)" : "transparent"; }}
    >
      <div style={{
        "font-size": "12px",
        color: "var(--text-primary)",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.task.title}
      </div>
      <div style={{ display: "flex", gap: "6px", "margin-top": "2px" }}>
        <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>{props.task.labels[0] ?? ""}</span>
        <Show when={props.task.priority}>
          <span style={{
            "font-size": "9px",
            padding: "0 4px",
            "border-radius": "2px",
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
            "text-transform": "capitalize",
          }}>
            {props.task.priority}
          </span>
        </Show>
      </div>
    </div>
  );
}
