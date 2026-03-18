import { createSignal } from "solid-js";
import type { Task } from "../../domain/models/Task";
import { api } from "../../infrastructure/api/apiClient";

export type TriageStatus = "priority" | "later" | "archived" | "dismissed";

export interface TaskTriage {
  id: string;
  taskId: string;
  triageStatus: TriageStatus;
  triagedAt: string;
}

export interface TriageDecision {
  taskId: string;
  triageStatus: TriageStatus;
}

const [triageMap, setTriageMap] = createSignal<Map<string, TriageStatus>>(new Map());
const [pendingDecisions, setPendingDecisions] = createSignal<TriageDecision[]>([]);
const [triageQueue, setTriageQueue] = createSignal<Task[]>([]);
const [currentIndex, setCurrentIndex] = createSignal(0);
const [isTriaging, setIsTriaging] = createSignal(false);
const [isSaving, setIsSaving] = createSignal(false);

export interface TriageSuggestion {
  taskId: string;
  taskTitle: string;
  suggestedStatus: "priority" | "later" | "archived";
  reason: string;
}

const [suggestions, setSuggestions] = createSignal<TriageSuggestion[]>([]);
const [suggestLoading, setSuggestLoading] = createSignal(false);

export function useTriageStore() {
  async function fetchTriage() {
    const data = await api.get<TaskTriage[]>("/triage");
    const map = new Map<string, TriageStatus>();
    for (const t of data) {
      map.set(t.taskId, t.triageStatus);
    }
    setTriageMap(map);
  }

  function startTriage(tasks: Task[]) {
    const map = triageMap();
    // Only queue tasks that haven't been triaged yet
    const untriaged = tasks.filter((t) => !map.has(t.id));
    setTriageQueue(untriaged);
    setCurrentIndex(0);
    setPendingDecisions([]);
    setIsTriaging(true);
  }

  function currentTask(): Task | null {
    const queue = triageQueue();
    const idx = currentIndex();
    return idx < queue.length ? queue[idx] : null;
  }

  function remainingCount(): number {
    return Math.max(0, triageQueue().length - currentIndex());
  }

  function swipe(status: TriageStatus) {
    const task = currentTask();
    if (!task) return;

    setPendingDecisions((prev) => [...prev, { taskId: task.id, triageStatus: status }]);
    setTriageMap((prev) => {
      const next = new Map(prev);
      next.set(task.id, status);
      return next;
    });
    setCurrentIndex((i) => i + 1);
  }

  function undoLast() {
    const decisions = pendingDecisions();
    if (decisions.length === 0) return;

    const last = decisions[decisions.length - 1];
    setPendingDecisions((prev) => prev.slice(0, -1));
    setTriageMap((prev) => {
      const next = new Map(prev);
      next.delete(last.taskId);
      return next;
    });
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  async function saveTriage() {
    const decisions = pendingDecisions();
    if (decisions.length === 0) return;

    setIsSaving(true);
    try {
      await api.post("/triage/bulk", { items: decisions });
      setPendingDecisions([]);
    } finally {
      setIsSaving(false);
    }
  }

  function stopTriage() {
    setIsTriaging(false);
  }

  async function finishTriage() {
    await saveTriage();
    setIsTriaging(false);
  }

  function getTaskStatus(taskId: string): TriageStatus | null {
    return triageMap().get(taskId) ?? null;
  }

  function getTasksByStatus(status: TriageStatus, allTasks: Task[]): Task[] {
    const map = triageMap();
    return allTasks.filter((t) => map.get(t.id) === status);
  }

  function getUntriagedTasks(allTasks: Task[]): Task[] {
    const map = triageMap();
    return allTasks.filter((t) => !map.has(t.id));
  }

  async function fetchSuggestions() {
    setSuggestLoading(true);
    try {
      const data = await api.post<TriageSuggestion[]>("/triage/suggest", {});
      setSuggestions(data);
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    } finally {
      setSuggestLoading(false);
    }
  }

  function clearSuggestions() {
    setSuggestions([]);
  }

  async function moveTask(taskId: string, newStatus: TriageStatus) {
    // Update local map immediately
    setTriageMap((prev) => {
      const next = new Map(prev);
      next.set(taskId, newStatus);
      return next;
    });
    // Persist to API
    await api.post("/triage", { taskId, triageStatus: newStatus });
  }

  async function untriagedMove(taskId: string) {
    // Remove from local map immediately
    setTriageMap((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    // Persist to API
    try {
      await api.delete(`/triage/${taskId}`);
    } catch (e) {
      console.error("Failed to remove triage decision:", e);
    }
  }

  return {
    triageMap, pendingDecisions, triageQueue, currentIndex,
    isTriaging, isSaving,
    suggestions, suggestLoading,
    fetchTriage, startTriage, currentTask, remainingCount,
    swipe, undoLast, saveTriage, stopTriage, finishTriage,
    getTaskStatus, getTasksByStatus, getUntriagedTasks, moveTask,
    fetchSuggestions, clearSuggestions, untriagedMove,
  };
}
