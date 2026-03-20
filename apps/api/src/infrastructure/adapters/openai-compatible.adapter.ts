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

  async *chatStream(messages: LlmMessage[], model: string): AsyncIterable<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed SSE data
        }
      }
    }
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
