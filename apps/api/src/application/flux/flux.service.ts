import type { FluxRepository } from "../../domain/flux/flux.repository";
import type {
  FluxItem, FluxStatus, FluxEntityType, SetFluxInput, FluxSuggestion,
  FluxFindOptions, FluxKanbanItem, FluxKanbanColumn, FluxCountsResult,
} from "../../domain/flux/flux.entity";
import type { TaskRepository } from "../../domain/task/task.repository";
import type { EmailRepository } from "../../domain/email/email.repository";
import type { RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeedRepository } from "../../domain/rss/rss.repository";
import type { LlmService } from "../llm/llm.service";

const SUGGEST_MAX_ITEMS = 100;
const ALL_STATUSES: FluxStatus[] = ["priority", "later", "archived", "dismissed"];
const ALL_ENTITY_TYPES: FluxEntityType[] = ["task", "email", "rss_article"];

export class FluxService {
  constructor(
    private repo: FluxRepository,
    private taskRepo?: TaskRepository,
    private llmService?: LlmService,
    private emailRepo?: EmailRepository,
    private rssArticleRepo?: RssArticleRepository,
    private rssFeedRepo?: RssFeedRepository,
  ) {}

  async getAll(entityType?: FluxEntityType): Promise<FluxItem[]> {
    return this.repo.findAll(entityType);
  }

  async getAllPaginated(options?: FluxFindOptions): Promise<{ data: FluxItem[]; total: number }> {
    return this.repo.findAllPaginated(options);
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

  // ─── Counts ───

  async getCounts(): Promise<FluxCountsResult> {
    const raw = await this.repo.countByTypeAndStatus();

    // Initialize all entity types with all statuses at 0
    const result: FluxCountsResult = {};
    for (const entityType of ALL_ENTITY_TYPES) {
      result[entityType] = {};
      for (const status of ALL_STATUSES) {
        result[entityType][status] = raw[entityType]?.[status] ?? 0;
      }
      // Add undecided count: we don't track undecided in flux_items,
      // so undecided = total entities - sum of flux items for that type
      result[entityType]["undecided"] = 0; // Will be populated if entity repos are available
    }

    // Count undecided items per type (entities with no flux_items row)
    if (this.taskRepo) {
      const totalTasks = await this.taskRepo.countAll();
      const decidedTasks = ALL_STATUSES.reduce((sum, s) => sum + (result["task"][s] ?? 0), 0);
      result["task"]["undecided"] = Math.max(0, totalTasks - decidedTasks);
    }
    // Email/RSS undecided counts are not computed here (would require countAll on their repos).
    // The decided counts from countByTypeAndStatus are still accurate.

    return result;
  }

  // ─── Kanban ───

  async getKanban(limit: number = 50): Promise<FluxKanbanColumn[]> {
    const columns: FluxKanbanColumn[] = [];

    // Fetch decided columns in parallel
    const [priorityResult, laterResult, archivedResult] = await Promise.all([
      this.repo.findByStatusPaginated("priority", undefined, limit, 0),
      this.repo.findByStatusPaginated("later", undefined, limit, 0),
      this.repo.findByStatusPaginated("archived", undefined, limit, 0),
    ]);

    // Collect all entity IDs to batch-fetch metadata
    const allFluxItems = [
      ...priorityResult.data,
      ...laterResult.data,
      ...archivedResult.data,
    ];

    // Batch-fetch entity metadata
    const entityMap = await this.batchFetchEntityMetadata(allFluxItems);

    // Build decided columns
    const decidedColumns: { status: FluxStatus; result: { data: FluxItem[]; total: number } }[] = [
      { status: "priority", result: priorityResult },
      { status: "later", result: laterResult },
      { status: "archived", result: archivedResult },
    ];

    // Build undecided column
    const undecidedItems = await this.getUndecidedItems(limit);
    columns.push({
      status: "undecided",
      items: undecidedItems.items,
      total: undecidedItems.total,
    });

    for (const col of decidedColumns) {
      const items: FluxKanbanItem[] = col.result.data.map(fi => {
        const meta = entityMap.get(`${fi.entityType}:${fi.entityId}`);
        return {
          entityType: fi.entityType,
          entityId: fi.entityId,
          fluxStatus: fi.fluxStatus,
          title: meta?.title ?? "(inconnu)",
          source: meta?.source ?? fi.entityType,
          preview: meta?.preview ?? null,
          date: meta?.date ?? fi.decidedAt.toISOString(),
        };
      });

      columns.push({
        status: col.status,
        items,
        total: col.result.total,
      });
    }

    return columns;
  }

  // ─── Suggest ───

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

    // Cap to SUGGEST_MAX_ITEMS to avoid oversized LLM prompts
    const capped = items.slice(0, SUGGEST_MAX_ITEMS);

    // Build prompt
    const itemsJson = capped.map((i, idx) => ({
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
          const item = capped.find(i => i.entityId === s.id);
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

  // ─── Private helpers ───

  private async batchFetchEntityMetadata(
    fluxItems: FluxItem[],
  ): Promise<Map<string, { title: string; source: string; preview: string | null; date: string | null }>> {
    const map = new Map<string, { title: string; source: string; preview: string | null; date: string | null }>();

    // Group by entity type
    const taskIds: string[] = [];
    const emailIds: string[] = [];
    const articleIds: string[] = [];

    for (const fi of fluxItems) {
      switch (fi.entityType) {
        case "task": taskIds.push(fi.entityId); break;
        case "email": emailIds.push(fi.entityId); break;
        case "rss_article": articleIds.push(fi.entityId); break;
      }
    }

    // Batch-fetch per entity type — one SQL query each instead of one per id
    // (previous Promise.all(map(findById)) was O(n) round-trips per kanban board).
    if (taskIds.length > 0 && this.taskRepo) {
      const tasks = await this.taskRepo.findByIds(taskIds);
      for (const t of tasks) {
        map.set(`task:${t.id}`, {
          title: t.title,
          source: t.source,
          preview: t.description?.slice(0, 120) ?? null,
          date: t.createdAt.toISOString(),
        });
      }
    }

    if (emailIds.length > 0 && this.emailRepo) {
      const emails = await this.emailRepo.findByIds(emailIds);
      for (const e of emails) {
        map.set(`email:${e.id}`, {
          title: e.subject ?? "(sans sujet)",
          source: e.fromName ?? e.fromAddress,
          preview: e.bodyText?.slice(0, 120) ?? null,
          date: e.sentAt.toISOString(),
        });
      }
    }

    if (articleIds.length > 0 && this.rssArticleRepo) {
      const articles = await this.rssArticleRepo.findByIds(articleIds);
      let feedLabelMap = new Map<string, string>();
      if (this.rssFeedRepo) {
        const feeds = await this.rssFeedRepo.findAll();
        feedLabelMap = new Map(feeds.map(f => [f.id, f.label]));
      }

      for (const a of articles) {
        map.set(`rss_article:${a.id}`, {
          title: a.title ?? "(sans titre)",
          source: feedLabelMap.get(a.feedId) ?? a.author ?? "RSS",
          preview: a.description?.slice(0, 120) ?? null,
          date: a.publishedAt?.toISOString() ?? a.createdAt.toISOString(),
        });
      }
    }

    return map;
  }

  private async getUndecidedItems(limit: number): Promise<{ items: FluxKanbanItem[]; total: number }> {
    // Undecided = entities that do NOT have a flux_items row
    // Strategy: fetch all tasks (paginated), filter out those with flux decisions
    const items: FluxKanbanItem[] = [];
    let total = 0;

    if (this.taskRepo) {
      const totalTasks = await this.taskRepo.countAll();
      const decidedTaskIds = new Set<string>();
      const allFlux = await this.repo.findAll("task");
      for (const f of allFlux) decidedTaskIds.add(f.entityId);

      const undecidedCount = Math.max(0, totalTasks - decidedTaskIds.size);
      total += undecidedCount;

      // Fetch tasks and filter out decided ones, up to limit
      if (undecidedCount > 0 && items.length < limit) {
        const tasks = await this.taskRepo.findAll({ limit: limit + decidedTaskIds.size });
        for (const t of tasks) {
          if (items.length >= limit) break;
          if (!decidedTaskIds.has(t.id)) {
            items.push({
              entityType: "task",
              entityId: t.id,
              fluxStatus: "priority", // placeholder, will be ignored since this is undecided
              title: t.title,
              source: t.source,
              preview: t.description?.slice(0, 120) ?? null,
              date: t.createdAt.toISOString(),
            });
          }
        }
      }
    }

    // Add undecided emails
    if (this.emailRepo && items.length < limit) {
      const decidedEmailIds = new Set<string>();
      const allFluxEmails = await this.repo.findAll("email");
      for (const f of allFluxEmails) decidedEmailIds.add(f.entityId);

      const allEmails = await this.emailRepo.findAll({ limit: limit + decidedEmailIds.size });
      let undecidedEmailCount = 0;
      for (const e of allEmails) {
        if (!decidedEmailIds.has(e.id)) {
          undecidedEmailCount++;
          if (items.length < limit) {
            items.push({
              entityType: "email",
              entityId: e.id,
              fluxStatus: "priority", // placeholder
              title: e.subject ?? "(sans sujet)",
              source: e.fromName ?? e.fromAddress,
              preview: e.bodyText?.slice(0, 120) ?? null,
              date: e.sentAt.toISOString(),
            });
          }
        }
      }
      total += undecidedEmailCount;
    }

    // Add undecided RSS articles
    if (this.rssArticleRepo && items.length < limit) {
      const decidedArticleIds = new Set<string>();
      const allFluxArticles = await this.repo.findAll("rss_article");
      for (const f of allFluxArticles) decidedArticleIds.add(f.entityId);

      let feedLabelMap = new Map<string, string>();
      if (this.rssFeedRepo) {
        const feeds = await this.rssFeedRepo.findAll();
        feedLabelMap = new Map(feeds.map(f => [f.id, f.label]));
      }

      const allArticles = await this.rssArticleRepo.findAll({ limit: limit + decidedArticleIds.size });
      let undecidedArticleCount = 0;
      for (const a of allArticles) {
        if (!decidedArticleIds.has(a.id)) {
          undecidedArticleCount++;
          if (items.length < limit) {
            items.push({
              entityType: "rss_article",
              entityId: a.id,
              fluxStatus: "priority", // placeholder
              title: a.title ?? "(sans titre)",
              source: feedLabelMap.get(a.feedId) ?? a.author ?? "RSS",
              preview: a.description?.slice(0, 120) ?? null,
              date: a.publishedAt?.toISOString() ?? a.createdAt.toISOString(),
            });
          }
        }
      }
      total += undecidedArticleCount;
    }

    return { items, total };
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
