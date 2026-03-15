import { createSignal } from "solid-js";
import type { UnscheduledTask } from "../../domain/models/ClickUpTask";
import { api } from "../../infrastructure/api/apiClient";

export type TriageStatus = "priority" | "later" | "archived" | "dismissed";

export interface TaskTriage {
  id: string;
  clickupTaskId: string;
  triageStatus: TriageStatus;
  triagedAt: string;
}

export interface TriageDecision {
  clickupTaskId: string;
  triageStatus: TriageStatus;
}

const [triageMap, setTriageMap] = createSignal<Map<string, TriageStatus>>(new Map());
const [pendingDecisions, setPendingDecisions] = createSignal<TriageDecision[]>([]);
const [triageQueue, setTriageQueue] = createSignal<UnscheduledTask[]>([]);
const [currentIndex, setCurrentIndex] = createSignal(0);
const [isTriaging, setIsTriaging] = createSignal(false);
const [isSaving, setIsSaving] = createSignal(false);

export function useTriageStore() {
  async function fetchTriage() {
    const data = await api.get<TaskTriage[]>("/triage");
    const map = new Map<string, TriageStatus>();
    for (const t of data) {
      map.set(t.clickupTaskId, t.triageStatus);
    }
    setTriageMap(map);
  }

  function startTriage(tasks: UnscheduledTask[]) {
    const map = triageMap();
    // Only queue tasks that haven't been triaged yet
    const untriaged = tasks.filter((t) => !map.has(t.clickupTaskId));
    setTriageQueue(untriaged);
    setCurrentIndex(0);
    setPendingDecisions([]);
    setIsTriaging(true);
  }

  function currentTask(): UnscheduledTask | null {
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

    setPendingDecisions((prev) => [...prev, { clickupTaskId: task.clickupTaskId, triageStatus: status }]);
    setTriageMap((prev) => {
      const next = new Map(prev);
      next.set(task.clickupTaskId, status);
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
      next.delete(last.clickupTaskId);
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

  function getTaskStatus(clickupTaskId: string): TriageStatus | null {
    return triageMap().get(clickupTaskId) ?? null;
  }

  function getTasksByStatus(status: TriageStatus, allTasks: UnscheduledTask[]): UnscheduledTask[] {
    const map = triageMap();
    return allTasks.filter((t) => map.get(t.clickupTaskId) === status);
  }

  function getUntriagedTasks(allTasks: UnscheduledTask[]): UnscheduledTask[] {
    const map = triageMap();
    return allTasks.filter((t) => !map.has(t.clickupTaskId));
  }

  async function moveTask(clickupTaskId: string, newStatus: TriageStatus) {
    // Update local map immediately
    setTriageMap((prev) => {
      const next = new Map(prev);
      next.set(clickupTaskId, newStatus);
      return next;
    });
    // Persist to API
    await api.post("/triage", { clickupTaskId, triageStatus: newStatus });
  }

  return {
    triageMap, pendingDecisions, triageQueue, currentIndex,
    isTriaging, isSaving,
    fetchTriage, startTriage, currentTask, remainingCount,
    swipe, undoLast, saveTriage, stopTriage, finishTriage,
    getTaskStatus, getTasksByStatus, getUntriagedTasks, moveTask,
  };
}
