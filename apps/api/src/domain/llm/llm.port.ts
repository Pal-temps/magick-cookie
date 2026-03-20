export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmPort {
  chat(messages: LlmMessage[], model: string): Promise<string>;
  chatStream(messages: LlmMessage[], model: string): AsyncIterable<string>;
  testConnection(model: string): Promise<boolean>;
}
