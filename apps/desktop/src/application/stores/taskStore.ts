import { createSignal } from "solid-js";
import type { Task, TaskDetailData, SyncResult } from "../../domain/models/Task";
import { api } from "../../infrastructure/api/apiClient";

const [tasks, setTasks] = createSignal<Task[]>([]);
const [selectedTask, setSelectedTask] = createSignal<Task | null>(null);
const [taskDetail, setTaskDetail] = createSignal<TaskDetailData | null>(null);
const [isLoadingTaskDetail, setIsLoadingTaskDetail] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);

export function useTaskStore() {
  async function fetchTasks() {
    const data = await api.get<Task[]>("/tasks");
    setTasks(data);
  }

  async function fetchUnscheduledTasks() {
    const data = await api.get<Task[]>("/tasks/unscheduled");
    setTasks(data);
  }

  async function syncConnector(source: string = "clickup") {
    setIsSyncing(true);
    try {
      await api.post<SyncResult>(`/connectors/${source}/sync`, {});
      await fetchTasks();
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

  return {
    tasks, selectedTask, taskDetail, isLoadingTaskDetail, isSyncing,
    setSelectedTask,
    fetchTasks, fetchUnscheduledTasks, syncConnector,
    openTaskDetail, closeTaskDetail,
  };
}
