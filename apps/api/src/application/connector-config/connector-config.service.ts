import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { ConnectorConfig, ConnectorType } from "../../domain/connector-config/connector-config.entity";

export class ConnectorConfigService {
  constructor(private repo: ConnectorConfigRepository) {}

  async getAll(): Promise<ConnectorConfig[]> {
    return this.repo.findAll();
  }

  async getByType(type: ConnectorType): Promise<ConnectorConfig | null> {
    return this.repo.findByType(type);
  }

  async save(type: ConnectorType, token: string, settings: Record<string, unknown>): Promise<ConnectorConfig> {
    return this.repo.upsert({ type, token, settings });
  }

  async delete(type: ConnectorType): Promise<void> {
    return this.repo.delete(type);
  }
}
