export interface WellnessConfig {
  id: string;
  type: string;
  label: string;
  intervalMinutes: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWellnessConfigInput {
  type: string;
  label: string;
  intervalMinutes: number;
  enabled?: boolean;
}

export interface UpdateWellnessConfigInput {
  label?: string;
  intervalMinutes?: number;
  enabled?: boolean;
}
