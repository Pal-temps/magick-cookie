export type ViewMode = "dashboard" | "month" | "week" | "day" | "notes" | "triage";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
