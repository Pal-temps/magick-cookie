export interface WellnessConfig {
  id: string;
  type: string;
  label: string;
  intervalMinutes: number;
  enabled: boolean;
  alertSound: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWellnessConfigInput {
  type: string;
  label: string;
  intervalMinutes: number;
  enabled?: boolean;
  alertSound?: string | null;
}

export interface UpdateWellnessConfigInput {
  label?: string;
  intervalMinutes?: number;
  enabled?: boolean;
  alertSound?: string | null;
}
