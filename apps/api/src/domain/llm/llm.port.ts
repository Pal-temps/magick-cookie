export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  jsonMode?: boolean;
}

export interface LlmPort {
  chat(messages: LlmMessage[], model: string, options?: ChatOptions): Promise<string>;
  chatStream(messages: LlmMessage[], model: string): AsyncIterable<string>;
  testConnection(model: string): Promise<boolean>;
}
