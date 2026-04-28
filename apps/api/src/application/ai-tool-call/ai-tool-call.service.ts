import type { AiToolCallRepository } from "../../domain/ai-tool-call/ai-tool-call.repository";
import type { AiToolCall, RecordToolCallInput, FindToolCallsOptions, ToolCallStatus } from "../../domain/ai-tool-call/ai-tool-call.entity";

export interface AiActivityStats {
  /** Total calls in the sample window. */
  totalCalls: number;
  /** Count grouped by tool name, sorted desc. */
  byTool: { toolName: string; count: number }[];
  /** Count grouped by status. */
  byStatus: Record<ToolCallStatus, number>;
  /** Mean of `durationMs` for `ok` calls only (null when no sample). */
  avgDurationMs: number | null;
  /** Last N failures (status != "ok"), most recent first. */
  recentFailures: AiToolCall[];
}

const RECENT_FAILURES_LIMIT = 20;

/** How many records the in-memory aggregation will scan. The dashboard caps the
 * window at the latest N calls to keep memory + JSON serialization bounded; for
 * deeper history we'd push aggregation to SQL. */
const STATS_SAMPLE_SIZE = 500;

export class AiToolCallService {
  constructor(private repo: AiToolCallRepository) {}

  async record(input: RecordToolCallInput): Promise<AiToolCall> {
    return this.repo.record(input);
  }

  async list(options?: FindToolCallsOptions): Promise<AiToolCall[]> {
    return this.repo.findAll(options);
  }

  /**
   * Aggregations over the most recent {@link STATS_SAMPLE_SIZE} calls. The
   * frontend "AI Activity" dashboard reads this for at-a-glance metrics.
   * Computes in memory because (a) sample is bounded, (b) avoids DB-specific
   * SQL in the application layer.
   */
  async getStats(): Promise<AiActivityStats> {
    const sample = await this.repo.findAll({ limit: STATS_SAMPLE_SIZE });

    const byToolMap = new Map<string, number>();
    const byStatus: Record<ToolCallStatus, number> = {
      ok: 0, error: 0, denied: 0, invalid_input: 0, rate_limited: 0,
    };
    let okDurationSum = 0;
    let okDurationCount = 0;
    const failures: AiToolCall[] = [];

    for (const call of sample) {
      byToolMap.set(call.toolName, (byToolMap.get(call.toolName) ?? 0) + 1);
      byStatus[call.status] += 1;
      if (call.status === "ok" && call.durationMs !== null) {
        okDurationSum += call.durationMs;
        okDurationCount += 1;
      } else if (call.status !== "ok" && failures.length < RECENT_FAILURES_LIMIT) {
        failures.push(call);
      }
    }

    const byTool = Array.from(byToolMap.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCalls: sample.length,
      byTool,
      byStatus,
      avgDurationMs: okDurationCount > 0 ? Math.round(okDurationSum / okDurationCount) : null,
      recentFailures: failures,
    };
  }
}
