export type ViewMode = "month" | "week" | "day";

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
