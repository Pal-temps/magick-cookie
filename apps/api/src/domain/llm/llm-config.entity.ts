export interface LlmConfig {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLlmConfigInput {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string | null;
  maxTokens?: number;
  temperature?: number;
  enabled?: boolean;
}
