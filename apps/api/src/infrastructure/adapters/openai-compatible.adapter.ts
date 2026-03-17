import type { LlmPort, LlmMessage } from "../../domain/llm/llm.port";

export class OpenAICompatibleAdapter implements LlmPort {
  constructor(
    private baseUrl: string,
    private apiKey?: string | null,
  ) {}

  async chat(messages: LlmMessage[], model: string): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API error ${res.status}: ${text}`);
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "";
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
