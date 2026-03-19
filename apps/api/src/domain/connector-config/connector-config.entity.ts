export type ConnectorType = "clickup" | "github" | "gitlab";

export interface ConnectorConfig {
  id: string;
  type: ConnectorType;
  token: string;
  settings: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
