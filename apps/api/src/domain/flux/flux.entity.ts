export type FluxStatus = "priority" | "later" | "archived" | "dismissed";
export type FluxEntityType = "task" | "email" | "rss_article";

export interface FluxItem {
  id: string;
  entityType: FluxEntityType;
  entityId: string;
  fluxStatus: FluxStatus;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetFluxInput {
  entityType: FluxEntityType;
  entityId: string;
  fluxStatus: FluxStatus;
}

export interface FluxSuggestion {
  entityType: FluxEntityType;
  entityId: string;
  entityTitle: string;
  suggestedStatus: "priority" | "later" | "archived";
  reason: string;
}

export interface FluxFindOptions {
  entityType?: FluxEntityType;
  status?: FluxStatus;
  limit?: number;
  offset?: number;
}

export interface FluxKanbanItem {
  entityType: FluxEntityType;
  entityId: string;
  fluxStatus: FluxStatus;
  title: string;
  source: string;
  preview: string | null;
  date: string | null;
}

export interface FluxKanbanColumn {
  status: FluxStatus | "undecided";
  items: FluxKanbanItem[];
  total: number;
}

export interface FluxCountsResult {
  [entityType: string]: {
    [status: string]: number;
  };
}
