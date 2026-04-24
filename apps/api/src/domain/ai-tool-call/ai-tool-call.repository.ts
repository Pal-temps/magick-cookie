import type { AiToolCall, RecordToolCallInput, FindToolCallsOptions } from "./ai-tool-call.entity";

export interface AiToolCallRepository {
  record(input: RecordToolCallInput): Promise<AiToolCall>;
  findAll(options?: FindToolCallsOptions): Promise<AiToolCall[]>;
}
