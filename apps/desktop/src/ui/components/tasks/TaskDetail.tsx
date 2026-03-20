import { Show, For, createSignal } from "solid-js";
import { CookieLoader } from "../common/CookieLoader";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Task } from "../../../domain/models/Task";
import { useTaskStore } from "../../../application/stores/taskStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { api } from "../../../infrastructure/api/apiClient";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";

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
  const { selectedTask, closeTaskDetail, taskDetail, isLoadingTaskDetail } = useTaskStore();
  const { createSnippet } = useSnippetStore();
  const { setViewMode } = useViewStore();
  const [generating, setGenerating] = createSignal(false);

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
        <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
          {/* Header: priority + status */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-wrap": "wrap" }}>
            <Show when={priorityLabel(task().priority)}>
              {(p) => (
                <span style={{
                  "font-size": "11px",
                  "font-weight": "600",
                  padding: "2px 8px",
                  "border-radius": "var(--radius-sm)",
                  background: p().color,
                  color: "#fff",
                }}>
                  {p().text}
                </span>
              )}
            </Show>
            <span style={{
              "font-size": "11px",
              padding: "2px 8px",
              "border-radius": "var(--radius-sm)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
            }}>
              {task().status}
            </span>
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
              {task().labels[0] ?? ""}
            </span>
          </div>

          {/* Title */}
          <h3 style={{ "font-size": "20px", "font-weight": "600", "line-height": "1.3" }}>
            {task().title}
          </h3>

          {/* Description — loaded from API */}
          <Show when={isLoadingTaskDetail()}>
            <CookieLoader size={32} message="Chargement..." />
          </Show>
          <Show when={!isLoadingTaskDetail() && taskDetail()?.description}>
            <div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "6px" }}>Description</div>
              <div style={{
                "font-size": "13px",
                color: "var(--text-secondary)",
                "white-space": "pre-wrap",
                "line-height": "1.5",
                "max-height": "200px",
                "overflow-y": "auto",
                padding: "12px",
                background: "var(--bg-elevated)",
                "border-radius": "var(--radius-md)",
              }}>
                {taskDetail()!.description}
              </div>
            </div>
          </Show>

          {/* Comments */}
          <Show when={!isLoadingTaskDetail() && taskDetail()?.comments && taskDetail()!.comments.length > 0}>
            <div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "6px" }}>
                Commentaires ({taskDetail()!.comments.length})
              </div>
              <div style={{
                display: "flex",
                "flex-direction": "column",
                gap: "8px",
                "max-height": "250px",
                "overflow-y": "auto",
              }}>
                <For each={taskDetail()!.comments}>
                  {(comment) => (
                    <div style={{
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      "border-radius": "var(--radius-md)",
                    }}>
                      <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "4px" }}>
                        <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)" }}>
                          {comment.user.username}
                        </span>
                        <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                          {formatCommentDate(comment.date)}
                        </span>
                      </div>
                      <div style={{
                        "font-size": "12px",
                        color: "var(--text-secondary)",
                        "white-space": "pre-wrap",
                        "line-height": "1.4",
                      }}>
                        {comment.commentText}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Assignees */}
          <Show when={task().assignees.length > 0}>
            <div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "4px" }}>Assignees</div>
              <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
                <For each={task().assignees}>
                  {(name) => (
                    <span style={{
                      "font-size": "12px",
                      padding: "2px 8px",
                      "border-radius": "var(--radius-sm)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                    }}>
                      {name}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", "margin-top": "4px", "flex-wrap": "wrap" }}>
            <Show when={task().url && task().source !== "manual"}>
              <Button variant="secondary" onClick={() => { if (task().url) openUrl(task().url!); }}>
                Ouvrir dans {sourceLabels[task().source] || "navigateur"}
              </Button>
            </Show>
            <AiButton
              variant="primary"
              disabled={generating() || isLoadingTaskDetail()}
              onClick={async () => {
                const { trackAiActivity } = await import("../../../application/stores/aiActivityStore");
                setGenerating(true);
                try {
                  const detail = taskDetail();
                  const comments = detail?.comments?.map((c) => c.commentText) ?? [];
                  const result = await trackAiActivity("Generation code IA", () =>
                    api.post<{ title: string; code: string; language: string; explanation: string }>(
                      "/llm/generate-code",
                      { title: task().title, description: detail?.description ?? task().description, comments },
                    )
                  );
                  if (result.code) {
                    await createSnippet({
                      title: result.title,
                      content: result.code,
                      language: result.language,
                      category: "generated",
                    });
                    closeTaskDetail();
                    setViewMode("library");
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
          </div>
        </div>
      </Show>
    </Modal>
  );
}
