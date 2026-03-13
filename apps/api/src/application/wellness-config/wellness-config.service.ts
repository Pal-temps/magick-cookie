import type { WellnessConfigRepository } from "../../domain/wellness-config/wellness-config.repository";
import type { WellnessConfig, CreateWellnessConfigInput, UpdateWellnessConfigInput } from "../../domain/wellness-config/wellness-config.entity";

const DEFAULT_CONFIGS: CreateWellnessConfigInput[] = [
  { type: "water", label: "Boire de l'eau", intervalMinutes: 45, enabled: true },
  { type: "break", label: "Faire une pause", intervalMinutes: 90, enabled: true },
  { type: "stretch", label: "S'étirer", intervalMinutes: 60, enabled: false },
  { type: "breathe", label: "Respirer profondément", intervalMinutes: 120, enabled: false },
];

export class WellnessConfigService {
  constructor(private wellnessConfigRepo: WellnessConfigRepository) {}

  async getAll(): Promise<WellnessConfig[]> {
    return this.wellnessConfigRepo.findAll();
  }

  async create(input: CreateWellnessConfigInput): Promise<WellnessConfig> {
    return this.wellnessConfigRepo.create(input);
  }

  async update(id: string, input: UpdateWellnessConfigInput): Promise<WellnessConfig | null> {
    return this.wellnessConfigRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.wellnessConfigRepo.delete(id);
  }

  async seedDefaults(): Promise<void> {
    const existing = await this.wellnessConfigRepo.findAll();
    if (existing.length > 0) return;

    for (const config of DEFAULT_CONFIGS) {
      await this.wellnessConfigRepo.create(config);
    }
  }
}
