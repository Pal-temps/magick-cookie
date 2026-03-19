import { createSignal } from "solid-js";
import type { Task, TaskSource, TaskDetailData, SyncResult } from "../../domain/models/Task";
import { api } from "../../infrastructure/api/apiClient";

const [tasks, setTasks] = createSignal<Task[]>([]);
const [selectedTask, setSelectedTask] = createSignal<Task | null>(null);
const [taskDetail, setTaskDetail] = createSignal<TaskDetailData | null>(null);
const [isLoadingTaskDetail, setIsLoadingTaskDetail] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);
const [sourceFilter, setSourceFilter] = createSignal<TaskSource | "all">("all");
const [configuredConnectors, setConfiguredConnectors] = createSignal<Set<string>>(new Set());

export interface ConnectorConfigSummary {
  type: string;
  enabled: boolean;
}

export function useTaskStore() {
  async function fetchTasks() {
    const src = sourceFilter();
    const url = src === "all" ? "/tasks" : `/tasks?source=${src}`;
    const data = await api.get<Task[]>(url);
    setTasks(data);
  }

  async function fetchUnscheduledTasks() {
    const src = sourceFilter();
    const url = src === "all"
      ? "/tasks/unscheduled"
      : `/tasks?source=${src}`;
    const data = await api.get<Task[]>(url);
    setTasks(data);
  }

  async function fetchConnectorConfigs() {
    try {
      const data = await api.get<ConnectorConfigSummary[]>("/connector-configs");
      const set = new Set<string>();
      for (const c of data) {
        if (c.enabled) set.add(c.type);
      }
      set.add("manual"); // manual is always "configured"
      setConfiguredConnectors(set);
    } catch {
      setConfiguredConnectors(new Set(["manual"]));
    }
  }

  async function syncConnector(source: string = "clickup") {
    setIsSyncing(true);
    try {
      await api.post<SyncResult>(`/connectors/${source}/sync`, {});
      await fetchUnscheduledTasks();
    } catch (err) {
      console.error(`Failed to sync ${source}:`, err);
    } finally {
      setIsSyncing(false);
    }
  }

  function openTaskDetail(task: Task) {
    setSelectedTask(task);
    setTaskDetail(null);
    setIsLoadingTaskDetail(true);
    api.get<TaskDetailData>(`/tasks/${task.id}/detail`)
      .then(setTaskDetail)
      .catch(() => setTaskDetail(null))
      .finally(() => setIsLoadingTaskDetail(false));
  }

  function closeTaskDetail() {
    setSelectedTask(null);
    setTaskDetail(null);
  }

  function isConnectorConfigured(source: TaskSource | "all"): boolean {
    if (source === "all") return true;
    return configuredConnectors().has(source);
  }

  return {
    tasks, selectedTask, taskDetail, isLoadingTaskDetail, isSyncing,
    sourceFilter, setSourceFilter,
    configuredConnectors,
    setSelectedTask,
    fetchTasks, fetchUnscheduledTasks, fetchConnectorConfigs, syncConnector,
    openTaskDetail, closeTaskDetail, isConnectorConfigured,
  };
}
