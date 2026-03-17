export type TriageStatus = "priority" | "later" | "archived" | "dismissed";

export interface TaskTriage {
  id: string;
  taskId: string;
  triageStatus: TriageStatus;
  triagedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetTriageInput {
  taskId: string;
  triageStatus: TriageStatus;
}
