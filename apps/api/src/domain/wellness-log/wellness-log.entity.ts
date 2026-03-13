export interface WellnessLog {
  id: string;
  type: string;
  date: string;
  value: number;
  goal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertWellnessLogInput {
  type: string;
  date: string;
  value: number;
  goal: number;
}
