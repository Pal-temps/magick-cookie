import type { WellnessConfig, CreateWellnessConfigInput, UpdateWellnessConfigInput } from "./wellness-config.entity";

export interface WellnessConfigRepository {
  findAll(): Promise<WellnessConfig[]>;
  findById(id: string): Promise<WellnessConfig | null>;
  findByType(type: string): Promise<WellnessConfig | null>;
  create(input: CreateWellnessConfigInput): Promise<WellnessConfig>;
  update(id: string, input: UpdateWellnessConfigInput): Promise<WellnessConfig | null>;
  delete(id: string): Promise<boolean>;
}
