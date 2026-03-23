import type { FluxRepository } from "../../domain/flux/flux.repository";
import type { FluxItem, FluxStatus, FluxEntityType, SetFluxInput, FluxSuggestion } from "../../domain/flux/flux.entity";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { LlmService } from "../llm/llm.service";

export class FluxService {
  constructor(
    private repo: FluxRepository,
    private taskRepo?: TaskRepository,
    private llmService?: LlmService,
  ) {}

  async getAll(entityType?: FluxEntityType): Promise<FluxItem[]> {
    return this.repo.findAll(entityType);
  }

  async getByStatus(status: FluxStatus, entityType?: FluxEntityType): Promise<FluxItem[]> {
    return this.repo.findByStatus(status, entityType);
  }

  async setFlux(input: SetFluxInput): Promise<FluxItem> {
    const item = await this.repo.upsert(input);
    await this.applySideEffects(input);
    return item;
  }

  async bulkSetFlux(inputs: SetFluxInput[]): Promise<void> {
    await this.repo.bulkUpsert(inputs);
    for (const input of inputs) {
      await this.applySideEffects(input);
    }
  }

  async resetFlux(entityType: FluxEntityType, entityId: string): Promise<void> {
    return this.repo.deleteByEntity(entityType, entityId);
  }

  async resetAll(): Promise<void> {
    return this.repo.deleteAll();
  }

  async suggestFlux(entityType?: FluxEntityType): Promise<FluxSuggestion[]> {
    if (!this.llmService) return [];

    // Get existing flux decisions
    const existing = await this.repo.findAll(entityType);
    const decidedKeys = new Set(existing.map(f => `${f.entityType}:${f.entityId}`));

    const items: { entityType: FluxEntityType; entityId: string; title: string; meta: string }[] = [];

    // Gather untriaged tasks
    if ((!entityType || entityType === "task") && this.taskRepo) {
      const tasks = await this.taskRepo.findAll();
      for (const t of tasks) {
        if (!decidedKeys.has(`task:${t.id}`)) {
          items.push({
            entityType: "task",
            entityId: t.id,
            title: t.title,
            meta: `source=${t.source} priority=${t.priority ?? "none"} status=${t.status} labels=${(t.labels ?? []).join(",")}`,
          });
        }
      }
    }

    // TODO: gather untriaged emails and RSS articles when their repos are injected

    if (items.length === 0) return [];

    // Build prompt
    const itemsJson = items.map((i, idx) => ({
      idx,
      type: i.entityType,
      id: i.entityId,
      title: i.title,
      meta: i.meta,
    }));

    const prompt = `Voici des elements non tries. Pour chacun, propose un statut parmi: "priority" (important/urgent), "later" (a traiter plus tard), "archived" (termine ou sans interet).

Reponds UNIQUEMENT en JSON, un tableau d'objets avec "id", "type", "status", "reason" (1 phrase courte).

Elements:
${JSON.stringify(itemsJson, null, 2)}`;

    try {
      const response = await this.llmService.chat([
        { role: "system", content: "Tu es un assistant de tri. Reponds uniquement en JSON valide." },
        { role: "user", content: prompt },
      ]);

      const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const suggestions = JSON.parse(jsonStr) as { id: string; type: string; status: string; reason: string }[];

      return suggestions
        .filter(s => ["priority", "later", "archived"].includes(s.status))
        .map(s => {
          const item = items.find(i => i.entityId === s.id);
          return {
            entityType: (s.type || item?.entityType || "task") as FluxEntityType,
            entityId: s.id,
            entityTitle: item?.title || "",
            suggestedStatus: s.status as "priority" | "later" | "archived",
            reason: s.reason,
          };
        });
    } catch {
      return [];
    }
  }

  // ─── Side-effects ───

  private async applySideEffects(input: SetFluxInput): Promise<void> {
    // Side-effects are handled via the API routes calling the respective services.
    // The flux service emits events that the routes layer can act on.
    // This keeps the flux service decoupled from email/rss service internals.
    //
    // For now, side-effects are handled in the routes layer via callbacks.
    // See flux.routes.ts for the implementation.
  }
}
