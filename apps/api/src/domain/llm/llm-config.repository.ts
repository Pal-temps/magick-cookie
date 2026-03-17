import type { LlmConfig, CreateLlmConfigInput } from "./llm-config.entity";

export interface LlmConfigRepository {
  getActive(): Promise<LlmConfig | null>;
  upsert(input: CreateLlmConfigInput): Promise<LlmConfig>;
}
