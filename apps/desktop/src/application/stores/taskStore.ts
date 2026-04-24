import { createSignal } from "solid-js";
import type { Task, TaskSource, TaskDetailData, SyncResult } from "../../domain/models/Task";
import { api } from "../../infrastructure/api/apiClient";

/** Response shape for paginated task endpoints */
interface PaginatedResponse<T> { data: T[]; total: number }

const PAGE_SIZE = 50;

const [tasks, setTasks] = createSignal<Task[]>([]);
const [totalTasks, setTotalTasks] = createSignal(0);
const [hasMoreTasks, setHasMoreTasks] = createSignal(false);
const [isLoadingMore, setIsLoadingMore] = createSignal(false);
const [selectedTask, setSelectedTask] = createSignal<Task | null>(null);
const [taskDetail, setTaskDetail] = createSignal<TaskDetailData | null>(null);
const [isLoadingTaskDetail, setIsLoadingTaskDetail] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);
const [sourceFilter, setSourceFilter] = createSignal<TaskSource | "all">("all");
const [configuredConnectors, setConfiguredConnectors] = createSignal<Set<string>>(new Set());

/** Track which fetch mode was last used so loadMore appends to the right endpoint */
let lastFetchMode: "all" | "unscheduled" = "all";

// Monotonic token — drops stale responses when sourceFilter changes mid-flight.
let fetchTasksToken = 0;

export interface ConnectorConfigSummary {
  type: string;
  enabled: boolean;
}

export function useTaskStore() {
  async function fetchTasks() {
    lastFetchMode = "all";
    const token = ++fetchTasksToken;
    const src = sourceFilter();
    const params = new URLSearchParams();
    if (src !== "all") params.set("source", src);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");
    const qs = params.toString();

    const raw = await api.getRaw<PaginatedResponse<Task>>(`/tasks?${qs}`);
    if (token !== fetchTasksToken) return;
    // Backward compatibility: if API returns old format without total
    const data = raw?.data ?? (raw as unknown as Task[]);
    const total = raw?.total ?? (Array.isArray(raw) ? (raw as unknown as Task[]).length : 0);

    setTasks(Array.isArray(data) ? data : []);
    setTotalTasks(total);
    setHasMoreTasks(Array.isArray(data) && data.length >= PAGE_SIZE && data.length < total);
  }

  async function fetchUnscheduledTasks() {
    lastFetchMode = "unscheduled";
    const token = ++fetchTasksToken;
    const src = sourceFilter();
    const params = new URLSearchParams();
    if (src !== "all") params.set("source", src);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", "0");

    const endpoint = src === "all" ? "/tasks/unscheduled" : "/tasks";
    const qs = params.toString();

    const raw = await api.getRaw<PaginatedResponse<Task>>(`${endpoint}?${qs}`);
    if (token !== fetchTasksToken) return;
    const data = raw?.data ?? (raw as unknown as Task[]);
    const total = raw?.total ?? (Array.isArray(raw) ? (raw as unknown as Task[]).length : 0);

    setTasks(Array.isArray(data) ? data : []);
    setTotalTasks(total);
    setHasMoreTasks(Array.isArray(data) && data.length >= PAGE_SIZE && data.length < total);
  }

  async function loadMoreTasks() {
    if (isLoadingMore() || !hasMoreTasks()) return;
    setIsLoadingMore(true);
    try {
      const src = sourceFilter();
      const offset = tasks().length;
      const params = new URLSearchParams();
      if (src !== "all") params.set("source", src);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const endpoint = lastFetchMode === "unscheduled" && src === "all"
        ? "/tasks/unscheduled"
        : "/tasks";
      const qs = params.toString();

      const raw = await api.getRaw<PaginatedResponse<Task>>(`${endpoint}?${qs}`);
      const data = raw?.data ?? (raw as unknown as Task[]);
      const total = raw?.total ?? totalTasks();

      if (Array.isArray(data) && data.length > 0) {
        setTasks((prev) => [...prev, ...data]);
      }
      setTotalTasks(total);
      const newLen = tasks().length;
      setHasMoreTasks(Array.isArray(data) && data.length >= PAGE_SIZE && newLen < total);
    } catch (err) {
      console.error("[tasks] Failed to load more tasks:", err);
    } finally {
      setIsLoadingMore(false);
    }
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

  async function createTask(title: string, description?: string) {
    try {
      const task = await api.post<Task>("/tasks", {
        source: "manual",
        title,
        description: description || null,
      });
      if (task) {
        setTasks((prev) => [task, ...prev]);
      }
      return task;
    } catch (err) {
      console.error("[tasks] Failed to create task:", err);
      throw err;
    }
  }

  async function updateTask(id: string, fields: Partial<Pick<Task, "title" | "startDate" | "dueDate" | "status" | "priority">>) {
    const prev = tasks();
    setTasks((t) => t.map((task) => task.id === id ? { ...task, ...fields, updatedAt: new Date().toISOString() } : task));
    try {
      const updated = await api.patch<Task>(`/tasks/${id}`, fields);
      if (updated) {
        setTasks((t) => t.map((task) => task.id === id ? updated : task));
      }
    } catch (err) {
      console.error("[tasks] Failed to update task:", err);
      setTasks(prev);
    }
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
    tasks, totalTasks, hasMoreTasks, isLoadingMore,
    selectedTask, taskDetail, isLoadingTaskDetail, isSyncing,
    sourceFilter, setSourceFilter,
    configuredConnectors,
    setSelectedTask,
    fetchTasks, fetchUnscheduledTasks, loadMoreTasks, fetchConnectorConfigs, syncConnector,
    createTask, updateTask, openTaskDetail, closeTaskDetail, isConnectorConfigured,
  };
}
