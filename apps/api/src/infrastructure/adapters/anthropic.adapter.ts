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

  async chat(messages: LlmMessage[], model: string): Promise<string> {
    // Anthropic API: system is a top-level param, not in messages
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: this.maxTokens,
      messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join("\n\n");
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
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
