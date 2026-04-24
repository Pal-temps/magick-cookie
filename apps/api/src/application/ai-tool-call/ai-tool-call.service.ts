import type { AiToolCallRepository } from "../../domain/ai-tool-call/ai-tool-call.repository";
import type { AiToolCall, RecordToolCallInput, FindToolCallsOptions } from "../../domain/ai-tool-call/ai-tool-call.entity";

export class AiToolCallService {
  constructor(private repo: AiToolCallRepository) {}

  async record(input: RecordToolCallInput): Promise<AiToolCall> {
    return this.repo.record(input);
  }

  async list(options?: FindToolCallsOptions): Promise<AiToolCall[]> {
    return this.repo.findAll(options);
  }
}
