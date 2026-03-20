import type { LlmPort, LlmMessage } from "../../domain/llm/llm.port";

const DEFAULT_BASE_URL = "https://api.anthropic.com";

export class AnthropicAdapter implements LlmPort {
  private baseUrl: string;

  constructor(
    private apiKey: string,
    baseUrl?: string,
    private maxTokens: number = 2048,
  ) {
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private buildBody(messages: LlmMessage[], model: string, stream: boolean): { body: Record<string, unknown>; systemMessages: LlmMessage[] } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: this.maxTokens,
      messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
      stream,
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join("\n\n");
    }

    return { body, systemMessages };
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  async chat(messages: LlmMessage[], model: string): Promise<string> {
    const { body } = this.buildBody(messages, model, false);

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const json = await res.json() as {
      content?: { type: string; text?: string }[];
    };

    return json.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("") ?? "";
  }

  async *chatStream(messages: LlmMessage[], model: string): AsyncIterable<string> {
    const { body } = this.buildBody(messages, model, true);

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
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
        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.type === "content_block_delta" && json.delta?.text) {
            yield json.delta.text;
          }
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
