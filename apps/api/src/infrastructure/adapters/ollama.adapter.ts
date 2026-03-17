import type { LlmPort, LlmMessage } from "../../domain/llm/llm.port";

export class OllamaAdapter implements LlmPort {
  constructor(private baseUrl: string) {}

  async chat(messages: LlmMessage[], model: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const json = await res.json() as { message?: { content?: string } };
    return json.message?.content ?? "";
  }

  async testConnection(model: string): Promise<boolean> {
    try {
      const result = await this.chat(
        [{ role: "user", content: "Say OK" }],
        model,
      );
      return result.length > 0;
    } catch {
      return false;
    }
  }
}
