import { Show, For, createSignal } from "solid-js";
import { CookieLoader } from "../common/CookieLoader";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Task } from "../../../domain/models/Task";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";
import { setCookiaContext } from "../../../application/stores/cookiaContextStore";
import { buildTaskPrompt } from "../ide/cookiaPromptBuilders";
import "../../styles/taskjar.css";

function priorityLabel(priority: string | null): { text: string; color: string } | null {
  switch (priority) {
    case "urgent": return { text: "Urgent", color: "#ef4444" };
    case "high": return { text: "High", color: "#f97316" };
    case "normal": return { text: "Normal", color: "#3b82f6" };
    case "low": return { text: "Low", color: "#9ca3af" };
    default: return null;
  }
}

function formatCommentDate(timestamp: string): string {
  const date = new Date(Number(timestamp));
  return date.toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function TaskDetail() {
  const { selectedTask, closeTaskDetail, taskDetail, isLoadingTaskDetail, generateCode } = useTaskStore();
  const { createSnippet } = useSnippetStore();
  const { setViewMode } = useViewStore();
  const [generating, setGenerating] = createSignal(false);

  function askCookia() {
    const t = task();
    const detail = taskDetail();
    setCookiaContext({
      prompt: buildTaskPrompt({
        name: t.title,
        description: detail?.description ?? null,
        priority: t.priority,
      }),
      source: "task",
    });
    closeTaskDetail();
    setViewMode("ide");
  }

  const task = () => selectedTask() as Task;

  const sourceLabels: Record<string, string> = {
    clickup: "ClickUp",
    github: "GitHub",
    gitlab: "GitLab",
    manual: "Manuelle",
  };

  const modalTitle = () => {
    const t = selectedTask();
    if (t) return `Tache ${sourceLabels[t.source] || ""}`;
    return "Tache";
  };

  return (
    <Modal isOpen={!!selectedTask()} onClose={closeTaskDetail} title={modalTitle()}>
      <Show when={selectedTask()}>
        <div class="taskjar-detail">
          {/* Header: priority + status */}
          <div class="taskjar-detail-header">
            <Show when={priorityLabel(task().priority)}>
              {(p) => (
                <span class="taskjar-detail-badge" style={{ background: p().color }}>
                  {p().text}
                </span>
              )}
            </Show>
            <span class="taskjar-detail-status">{task().status}</span>
            <span class="taskjar-detail-label">{task().labels[0] ?? ""}</span>
          </div>

          {/* Title */}
          <h3 class="taskjar-detail-title">{task().title}</h3>

          {/* Description */}
          <Show when={isLoadingTaskDetail()}>
            <CookieLoader size={32} message="Chargement..." />
          </Show>
          <Show when={!isLoadingTaskDetail() && taskDetail()?.description}>
            <div>
              <div class="taskjar-detail-section-label">Description</div>
              <div class="taskjar-detail-desc">{taskDetail()!.description}</div>
            </div>
          </Show>

          {/* Comments */}
          <Show when={!isLoadingTaskDetail() && taskDetail()?.comments && taskDetail()!.comments.length > 0}>
            <div>
              <div class="taskjar-detail-section-label">
                Commentaires ({taskDetail()!.comments.length})
              </div>
              <div class="taskjar-detail-comments">
                <For each={taskDetail()!.comments}>
                  {(comment) => (
                    <div class="taskjar-detail-comment">
                      <div class="taskjar-detail-comment-header">
                        <span class="taskjar-detail-comment-user">{comment.user.username}</span>
                        <span class="taskjar-detail-comment-date">{formatCommentDate(comment.date)}</span>
                      </div>
                      <div class="taskjar-detail-comment-text">{comment.commentText}</div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Assignees */}
          <Show when={task().assignees.length > 0}>
            <div>
              <div class="taskjar-detail-section-label">Assignees</div>
              <div class="taskjar-detail-assignees">
                <For each={task().assignees}>
                  {(name) => <span class="taskjar-detail-assignee">{name}</span>}
                </For>
              </div>
            </div>
          </Show>

          {/* Actions */}
          <div class="taskjar-detail-actions">
            <Show when={task().url && task().source !== "manual"}>
              <Button variant="secondary" onClick={() => { if (task().url) openUrl(task().url!); }}>
                Ouvrir dans {sourceLabels[task().source] || "navigateur"}
              </Button>
            </Show>
            <AiButton
              variant="primary"
              disabled={generating() || isLoadingTaskDetail()}
              onClick={async () => {
                setGenerating(true);
                try {
                  const result = await generateCode(task().id);
                  if (result.code) {
                    await createSnippet({
                      title: result.title,
                      content: result.code,
                      language: result.language,
                      tags: ["generated"],
                    });
                    closeTaskDetail();
                    const { useViewStore: getViewStore } = await import("../../../application/stores/viewStore");
                    getViewStore().setNotesMainTab("snippets");
                    setViewMode("notes");
                  }
                } catch (e) {
                  console.error("Failed to generate code:", e);
                } finally {
                  setGenerating(false);
                }
              }}
            >
              {generating() ? "Generation..." : "Generer du code"}
            </AiButton>
            <AiButton variant="secondary" onClick={askCookia}>
              Ask Cookia
            </AiButton>
          </div>
        </div>
      </Show>
    </Modal>
  );
}
