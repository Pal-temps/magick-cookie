import { useAiSessionStore } from "../../../application/stores/aiSessionStore";

// Approximate pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "default": { input: 3, output: 15 },
};

function estimateTokens(text: string): number {
  // Rough: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatDuration(startMs: number): string {
  const elapsed = Date.now() - startMs;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h${(mins % 60).toString().padStart(2, "0")}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TokenStatusBar() {
  const ai = useAiSessionStore();

  const session = () => ai.activeSession();

  const stats = () => {
    const s = session();
    if (!s) return null;

    let inputTokens = 0;
    let outputTokens = 0;
    let msgCount = 0;
    const startTime = s.messages[0]?.timestamp ?? Date.now();

    for (const m of s.messages) {
      const tokens = estimateTokens(m.content);
      if (m.type === "user") inputTokens += tokens;
      else if (m.type === "assistant") outputTokens += tokens;
      if (m.type === "user" || m.type === "assistant") msgCount++;
    }

    const model = s.model.toLowerCase();
    const pricing = MODEL_PRICING[model] ??
      Object.entries(MODEL_PRICING).find(([k]) => model.includes(k))?.[1] ??
      MODEL_PRICING["default"];

    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

    return {
      totalTokens: inputTokens + outputTokens,
      cost,
      model: s.model || s.provider,
      duration: formatDuration(startTime),
      msgCount,
    };
  };

  return (
    <div class="cc-token-bar">
      {(() => {
        const s = stats();
        if (!s) return null;
        return (
          <>
            <span class="cc-token-bar__dot" />
            <span class="cc-token-bar__item">{formatTokens(s.totalTokens)} tokens</span>
            <span class="cc-token-bar__sep">&middot;</span>
            <span class="cc-token-bar__item">{formatCost(s.cost)}</span>
            <span class="cc-token-bar__sep">&middot;</span>
            <span class="cc-token-bar__item cc-token-bar__model">{s.model}</span>
            <span class="cc-token-bar__sep">&middot;</span>
            <span class="cc-token-bar__item">{s.duration}</span>
            <span class="cc-token-bar__sep">&middot;</span>
            <span class="cc-token-bar__item">{s.msgCount} msg</span>
          </>
        );
      })()}
    </div>
  );
}
