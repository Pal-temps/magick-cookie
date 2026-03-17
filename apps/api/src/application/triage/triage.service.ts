import type { TriageRepository } from "../../domain/triage/triage.repository";
import type { TaskTriage, SetTriageInput, TriageStatus } from "../../domain/triage/triage.entity";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { LlmService } from "../llm/llm.service";

export interface TriageSuggestion {
  taskId: string;
  taskTitle: string;
  suggestedStatus: "priority" | "later" | "archived";
  reason: string;
}

export class TriageService {
  constructor(
    private repo: TriageRepository,
    private taskRepo?: TaskRepository,
    private llmService?: LlmService,
  ) {}

  async getAll(): Promise<TaskTriage[]> {
    return this.repo.findAll();
  }

  async getByStatus(status: TriageStatus): Promise<TaskTriage[]> {
    return this.repo.findByStatus(status);
  }

  async setTriage(input: SetTriageInput): Promise<TaskTriage> {
    return this.repo.upsert(input);
  }

  async bulkSetTriage(inputs: SetTriageInput[]): Promise<void> {
    return this.repo.bulkUpsert(inputs);
  }

  async resetTriage(taskId: string): Promise<void> {
    return this.repo.deleteByTaskId(taskId);
  }

  async resetAll(): Promise<void> {
    return this.repo.deleteAll();
  }

  async suggestTriage(): Promise<TriageSuggestion[]> {
    if (!this.llmService || !this.taskRepo) return [];

    // Get all tasks
    const allTasks = await this.taskRepo.findAll();
    // Get all existing triage decisions
    const triaged = await this.repo.findAll();
    const triagedIds = new Set(triaged.map(t => t.taskId));

    // Find untriaged tasks
    const untriaged = allTasks.filter(t => !triagedIds.has(t.id));
    if (untriaged.length === 0) return [];

    // Build prompt
    const tasksJson = untriaged.map(t => ({
      id: t.id,
      title: t.title,
      source: t.source,
      status: t.status,
      priority: t.priority,
      labels: t.labels,
      daysOld: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const prompt = `Voici des taches de developpement non triees. Pour chaque tache, propose un statut de triage parmi: "priority" (urgent/important), "later" (a faire plus tard), "archived" (terminee ou plus pertinente).

Reponds UNIQUEMENT en JSON, un tableau d'objets avec "id", "status", "reason" (1 phrase courte).

Taches:
${JSON.stringify(tasksJson, null, 2)}`;

    try {
      const response = await this.llmService.chat([
        { role: "system", content: "Tu es un assistant de triage de taches. Reponds uniquement en JSON valide." },
        { role: "user", content: prompt },
      ]);

      // Parse JSON from response (handle markdown code blocks)
      const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const suggestions = JSON.parse(jsonStr) as { id: string; status: string; reason: string }[];

      return suggestions
        .filter(s => ["priority", "later", "archived"].includes(s.status))
        .map(s => ({
          taskId: s.id,
          taskTitle: untriaged.find(t => t.id === s.id)?.title || "",
          suggestedStatus: s.status as "priority" | "later" | "archived",
          reason: s.reason,
        }));
    } catch {
      return [];
    }
  }
}
