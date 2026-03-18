import type { LlmConfigRepository } from "../../domain/llm/llm-config.repository";
import type { LlmConfig, CreateLlmConfigInput } from "../../domain/llm/llm-config.entity";
import type { LlmPort, LlmMessage } from "../../domain/llm/llm.port";
import { OllamaAdapter } from "../../infrastructure/adapters/ollama.adapter";
import { OpenAICompatibleAdapter } from "../../infrastructure/adapters/openai-compatible.adapter";
import { AnthropicAdapter } from "../../infrastructure/adapters/anthropic.adapter";

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

  async classify(text: string, categories: string[]): Promise<string> {
    const catList = categories.join(", ");
    const response = await this.chat([
      {
        role: "system",
        content: `Tu es un classificateur d'emails. Tu dois classer le texte dans EXACTEMENT UNE de ces categories : ${catList}. Reponds UNIQUEMENT avec le nom de la categorie, rien d'autre. Pas d'explication, pas de ponctuation, juste le mot de la categorie.`,
      },
      { role: "user", content: text },
    ]);
    const normalized = response.trim().toLowerCase();
    return categories.includes(normalized) ? normalized : "autre";
  }

  async generateNarrative(data: string, systemPrompt: string): Promise<string> {
    return this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: data },
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
      case "anthropic":
        if (!config.apiKey) throw new Error("Anthropic API key required");
        return new AnthropicAdapter(config.apiKey, config.baseUrl, config.maxTokens);
      case "lmstudio":
      case "openai-compatible":
        return new OpenAICompatibleAdapter(config.baseUrl, config.apiKey);
      case "ollama":
      default:
        return new OllamaAdapter(config.baseUrl);
    }
  }
}
