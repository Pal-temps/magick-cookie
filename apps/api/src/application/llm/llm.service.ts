import type { LlmConfigRepository } from "../../domain/llm/llm-config.repository";
import type { LlmConfig, CreateLlmConfigInput } from "../../domain/llm/llm-config.entity";
import type { LlmPort, LlmMessage } from "../../domain/llm/llm.port";
import { OllamaAdapter } from "../../infrastructure/adapters/ollama.adapter";
import { OpenAICompatibleAdapter } from "../../infrastructure/adapters/openai-compatible.adapter";

export class LlmService {
  constructor(private configRepo: LlmConfigRepository) {}

  async getConfig(): Promise<LlmConfig | null> {
    return this.configRepo.getActive();
  }

  async updateConfig(input: CreateLlmConfigInput): Promise<LlmConfig> {
    return this.configRepo.upsert(input);
  }

  async chat(messages: LlmMessage[]): Promise<string> {
    const config = await this.configRepo.getActive();
    if (!config) throw new Error("No LLM configured");

    const adapter = this.createAdapter(config);
    return adapter.chat(messages, config.model);
  }

  async summarize(text: string, systemPrompt: string): Promise<string> {
    return this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);
  }

  async testConnection(): Promise<boolean> {
    const config = await this.configRepo.getActive();
    if (!config) return false;

    const adapter = this.createAdapter(config);
    return adapter.testConnection(config.model);
  }

  private createAdapter(config: LlmConfig): LlmPort {
    switch (config.provider) {
      case "ollama":
        return new OllamaAdapter(config.baseUrl);
      case "lmstudio":
      case "openai-compatible":
      default:
        return new OpenAICompatibleAdapter(config.baseUrl, config.apiKey);
    }
  }
}
