export type TriageStatus = "priority" | "later" | "archived" | "dismissed";

export interface TaskTriage {
  id: string;
  clickupTaskId: string;
  triageStatus: TriageStatus;
  triagedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetTriageInput {
  clickupTaskId: string;
  triageStatus: TriageStatus;
}
