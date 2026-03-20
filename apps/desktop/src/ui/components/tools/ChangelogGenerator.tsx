import { createSignal, Show } from "solid-js";
import { api } from "../../../infrastructure/api/apiClient";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";

interface ChangelogResult {
  commits: { hash: string; message: string; repo: string }[];
  changelog: string;
}

export function ChangelogGenerator() {
  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  })();
  const [sinceDate, setSinceDate] = createSignal(defaultDate);
  const [repo, setRepo] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [result, setResult] = createSignal<ChangelogResult | null>(null);
  const [copied, setCopied] = createSignal(false);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body: { since: string; repo?: string } = { since: sinceDate() };
      const r = repo().trim();
      if (r) body.repo = r;
      const data = await api.post<ChangelogResult>("/changelog/generate", body);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la generation");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    const r = result();
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.changelog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
      {/* Header */}
      <span style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
        Changelog
      </span>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", "align-items": "flex-end", "flex-wrap": "wrap" }}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <label style={{ "font-size": "11px", color: "var(--text-muted)" }}>Depuis</label>
          <input
            type="date"
            value={sinceDate()}
            onInput={(e) => setSinceDate(e.currentTarget.value)}
            style={{
              padding: "5px 8px",
              "font-size": "12px",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <label style={{ "font-size": "11px", color: "var(--text-muted)" }}>Repo (optionnel)</label>
          <input
            type="text"
            value={repo()}
            onInput={(e) => setRepo(e.currentTarget.value)}
            placeholder="nom-du-repo"
            style={{
              padding: "5px 8px",
              "font-size": "12px",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-sm)",
              outline: "none",
              width: "180px",
            }}
          />
        </div>
        <AiButton size="sm" variant="primary" onClick={handleGenerate} disabled={loading()}>
          {loading() ? "Generation..." : "Generer"}
        </AiButton>
      </div>

      {/* Error */}
      <Show when={error()}>
        <div style={{
          padding: "8px 12px",
          background: "rgba(214, 48, 49, 0.1)",
          color: "#d63031",
          "border-radius": "var(--radius-md)",
          "font-size": "12px",
        }}>
          {error()}
        </div>
      </Show>

      {/* Result */}
      <Show when={result()}>
        {(r) => (
          <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
              <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
                {r().commits.length} commit{r().commits.length > 1 ? "s" : ""} trouves
              </span>
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied() ? "Copie !" : "Copier"}
              </Button>
            </div>
            <div style={{
              padding: "12px 16px",
              background: "var(--bg-elevated)",
              "border-radius": "var(--radius-md)",
              border: "1px solid var(--border-color)",
              "font-size": "13px",
              "line-height": "1.6",
              color: "var(--text-primary)",
              "white-space": "pre-wrap",
              "max-height": "400px",
              overflow: "auto",
              "font-family": "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            }}>
              {r().changelog}
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
