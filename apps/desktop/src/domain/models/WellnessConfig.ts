export interface WellnessConfig {
  id: string;
  type: string;
  label: string;
  intervalMinutes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWellnessConfigDTO {
  type: string;
  label: string;
  intervalMinutes: number;
  enabled?: boolean;
}

export interface UpdateWellnessConfigDTO {
  label?: string;
  intervalMinutes?: number;
  enabled?: boolean;
}
