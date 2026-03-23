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
