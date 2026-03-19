import type { ConnectorType, ConnectorConfig } from "./connector-config.entity";

export interface ConnectorConfigRepository {
  findByType(type: ConnectorType): Promise<ConnectorConfig | null>;
  findAll(): Promise<ConnectorConfig[]>;
  upsert(input: { type: ConnectorType; token: string; settings: Record<string, unknown> }): Promise<ConnectorConfig>;
  delete(type: ConnectorType): Promise<void>;
}
