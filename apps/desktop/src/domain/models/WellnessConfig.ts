export interface WellnessConfig {
  id: string;
  type: string;
  label: string;
  intervalMinutes: number;
  enabled: boolean;
  alertSound: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWellnessConfigDTO {
  type: string;
  label: string;
  intervalMinutes: number;
  enabled?: boolean;
  alertSound?: string | null;
}

export interface UpdateWellnessConfigDTO {
  label?: string;
  intervalMinutes?: number;
  enabled?: boolean;
  alertSound?: string | null;
}
