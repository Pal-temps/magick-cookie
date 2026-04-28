import { createSignal, For, Show, createMemo } from "solid-js";
import { useSnippetStore, type Snippet, type CreateSnippetInput } from "../../../application/stores/snippetStore";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";
import { CookieLoader } from "../common/CookieLoader";
import { MonacoEditor } from "../ide/MonacoEditor";
import { useT } from "../../../i18n/context";
import { API_BASE, authHeaders } from "../../../infrastructure/config";
import { setCookiaContext } from "../../../application/stores/cookiaContextStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { buildSnippetPrompt } from "../ide/cookiaPromptBuilders";
const BENCHABLE_LANGS = new Set(["javascript", "typescript"]);

const LANGUAGES = [
  "text", "bash", "javascript", "typescript", "python", "sql", "css", "html",
  "json", "yaml", "docker", "go", "rust", "java", "csharp", "php", "ruby",
  "swift", "kotlin", "markdown", "xml", "toml", "ini", "powershell", "lua",
];

export function SnippetView() {
  const { t } = useT();
  const store = useSnippetStore();
  const { setViewMode } = useViewStore();

  function askCookia(snippet: Snippet) {
    setCookiaContext({
      prompt: buildSnippetPrompt({ title: snippet.title, language: snippet.language, content: snippet.content }),
      source: "snippet",
    });
    setViewMode("ide");
  }
  const {
    snippets, selectedSnippet, setSelectedSnippet,
    createSnippet, updateSnippet, deleteSnippet, toggleFavorite,
  } = store;

  // Use shared filter signals from the store (controlled by sidebar)
  const filter = store.filterQuery;
  const filterLanguage = store.filterLanguage;
  const filterTag = store.filterTag;
  const filterFavorites = store.filterFavorites;
  const [showForm, setShowForm] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [copyFeedback, setCopyFeedback] = createSignal(false);

  // Form fields
  const [formTitle, setFormTitle] = createSignal("");
  const [formContent, setFormContent] = createSignal("");
  const [formLanguage, setFormLanguage] = createSignal("text");
  const [formFavorite, setFormFavorite] = createSignal(false);
  const [formTagsInput, setFormTagsInput] = createSignal("");

  // ─── Inline benchmark ───
  const [benchRunning, setBenchRunning] = createSignal(false);
  const [benchResult, setBenchResult] = createSignal<string | null>(null);
  const [benchError, setBenchError] = createSignal<string | null>(null);

  async function runSnippetBench(snippet: Snippet) {
    setBenchRunning(true);
    setBenchResult(null);
    setBenchError(null);
    try {
      const res = await fetch(`${API_BASE}/bench/run/function`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ code: snippet.content, name: snippet.title, iterations: 1000, warmup: 100, timeoutMs: 10000 }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          let event = "message", data = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7);
            else if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (event === "result" && data) {
            const r = JSON.parse(data);
            const t = r.timing;
            setBenchResult(
              `${t.opsPerSec.toLocaleString()} ops/s  |  avg: ${t.avg.toFixed(3)}ms  |  p50: ${t.p50.toFixed(3)}ms  |  p95: ${t.p95.toFixed(3)}ms  |  p99: ${t.p99.toFixed(3)}ms  |  min: ${t.min.toFixed(3)}ms  |  max: ${t.max.toFixed(3)}ms`
            );
          } else if (event === "error" && data) {
            setBenchError(data);
          }
        }
      }
    } catch (e) {
      setBenchError(String(e));
    } finally {
      setBenchRunning(false);
    }
  }

  const filtered = createMemo(() => {
    let list = snippets();
    if (filterFavorites()) list = list.filter((s) => s.isFavorite);
    if (filterLanguage() !== "all") list = list.filter((s) => s.language === filterLanguage());
    if (filterTag() !== "all") list = list.filter((s) => s.tags.includes(filterTag()));
    const q = filter().toLowerCase();
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || s.language.toLowerCase().includes(q) || s.tags.some((tag) => tag.toLowerCase().includes(q)));
    return list;
  });

  function parseTags(raw: string): string[] {
    return raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  function resetForm() {
    setFormTitle(""); setFormContent(""); setFormLanguage("text"); setFormFavorite(false); setFormTagsInput("");
    setShowForm(false); setEditingId(null);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(s: Snippet) {
    setFormTitle(s.title);
    setFormContent(s.content);
    setFormLanguage(s.language);
    setFormFavorite(s.isFavorite);
    setFormTagsInput(s.tags.join(", "));
    setEditingId(s.id);
    setShowForm(true);
  }

  async function handleSave() {
    const title = formTitle().trim();
    const content = formContent();
    if (!title) return;
    const input: CreateSnippetInput = {
      title,
      content,
      language: formLanguage(),
      tags: parseTags(formTagsInput()),
      isFavorite: formFavorite(),
    };
    if (editingId()) {
      const updated = await updateSnippet(editingId()!, input);
      if (updated) setSelectedSnippet(updated);
    } else {
      const created = await createSnippet(input);
      if (created) setSelectedSnippet(created);
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteSnippet(id);
    if (editingId() === id) resetForm();
  }

  async function handleCopy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    } catch {
      // Fallback: ignore
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    "border-radius": "var(--radius-sm)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box" as const,
    "color-scheme": "dark",
  };

  const tagChipStyle = {
    display: "inline-block",
    padding: "1px 6px",
    "font-size": "10px",
    "border-radius": "var(--radius-sm)",
    background: "var(--accent-color)",
    color: "#fff",
    "font-family": "monospace",
    cursor: "pointer",
  };

  const sel = () => selectedSnippet();

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Snippet list */}
      <div style={{
        flex: "1",
        "min-width": "280px",
        "border-right": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "12px", display: "flex", gap: "8px", "align-items": "center", "border-bottom": "1px solid var(--border-color)" }}>
          <input
            type="text"
            placeholder={t("snippets.searchPlaceholder")}
            value={filter()}
            onInput={(e) => store.setFilterQuery(e.currentTarget.value)}
            style={{ ...inputStyle, flex: "1" }}
          />
          <Button variant="primary" size="sm" onClick={startCreate}>{t("snippets.newSnippet")}</Button>
        </div>

        {/* List */}
        <div style={{ flex: "1", "overflow-y": "auto" }}>
          <For each={filtered()}>
            {(snippet) => (
              <div
                onClick={() => setSelectedSnippet(snippet)}
                style={{
                  padding: "5px 10px",
                  "border-bottom": "1px solid var(--border-color)",
                  cursor: "pointer",
                  background: sel()?.id === snippet.id ? "var(--bg-elevated)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (sel()?.id !== snippet.id) e.currentTarget.style.background = "var(--bg-surface)"; }}
                onMouseLeave={(e) => { if (sel()?.id !== snippet.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--text-primary)", flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {snippet.title}
                  </span>
                  <For each={snippet.tags}>
                    {(tag) => (
                      <span
                        style={tagChipStyle}
                        onClick={(e) => { e.stopPropagation(); store.setFilterTag(tag); store.setFilterFavorites(false); }}
                        title={`${t("snippets.filterByTag")}: ${tag}`}
                      >
                        {tag}
                      </span>
                    )}
                  </For>
                  <span style={{
                    padding: "1px 5px", "font-size": "9px", "border-radius": "var(--radius-sm)",
                    background: "var(--bg-elevated)", color: "var(--text-muted)",
                    "font-family": "monospace", "flex-shrink": "0",
                  }}>
                    {snippet.language}
                  </span>
                  <Show when={snippet.isFavorite}>
                    <span style={{ "font-size": "11px", color: "var(--accent-secondary)", "flex-shrink": "0" }}>&#9733;</span>
                  </Show>
                </div>
              </div>
            )}
          </For>

          <Show when={filtered().length === 0 && snippets().length > 0}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "20px", "text-align": "center" }}>
              {t("snippets.noMatch")}
            </div>
          </Show>

          <Show when={snippets().length === 0}>
            <div style={{ "font-size": "13px", color: "var(--text-muted)", padding: "40px 20px", "text-align": "center" }}>
              {t("snippets.empty")}
            </div>
          </Show>
        </div>
      </div>

      {/* Right panel — detail / form */}
      <div style={{ flex: "1.2", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
        {/* Create/Edit form */}
        <Show when={showForm()}>
          <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
            {/* Form header */}
            <div style={{
              padding: "12px 16px",
              "border-bottom": "1px solid var(--border-color)",
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "flex-shrink": "0",
              background: "var(--bg-surface)",
            }}>
              <span style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                {editingId() ? t("snippets.editSnippet") : t("snippets.newSnippet")}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <Button variant="ghost" size="sm" onClick={resetForm}>{t("common.cancel")}</Button>
                <Button variant="primary" size="sm" onClick={handleSave}>{editingId() ? t("common.save") : t("common.create")}</Button>
              </div>
            </div>

            {/* Form fields */}
            <div style={{ padding: "12px 16px", display: "flex", "flex-direction": "column", gap: "10px", "flex-shrink": "0", "border-bottom": "1px solid var(--border-color)" }}>
              {/* Title */}
              <input
                type="text"
                value={formTitle()}
                onInput={(e) => setFormTitle(e.currentTarget.value)}
                placeholder={t("snippets.mySnippet")}
                style={{ ...inputStyle, "font-size": "14px", "font-weight": "500", padding: "8px 12px" }}
              />
              {/* Language + Favorite — row */}
              <div style={{ display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" }}>
                <select
                  value={formLanguage()}
                  onChange={(e) => setFormLanguage(e.currentTarget.value)}
                  style={{ ...inputStyle, cursor: "pointer", height: "30px", "font-size": "11px", width: "auto", flex: "1", "min-width": "120px" }}
                >
                  <For each={LANGUAGES}>
                    {(lang) => <option value={lang}>{lang}</option>}
                  </For>
                </select>
                <label style={{ display: "flex", "align-items": "center", gap: "4px", "font-size": "11px", color: "var(--text-muted)", cursor: "pointer", "flex-shrink": "0" }}>
                  <input type="checkbox" checked={formFavorite()} onChange={(e) => setFormFavorite(e.currentTarget.checked)} style={{ cursor: "pointer" }} />
                  {t("snippets.favorite")}
                </label>
              </div>
              {/* Tags */}
              <input
                type="text"
                value={formTagsInput()}
                onInput={(e) => setFormTagsInput(e.currentTarget.value)}
                placeholder={t("snippets.tagsPlaceholder")}
                style={{ ...inputStyle, "font-size": "11px" }}
              />
            </div>

            {/* Monaco editor — takes all remaining space */}
            <div style={{ flex: "1", overflow: "hidden", "min-height": "0" }}>
              <MonacoEditor
                value={formContent()}
                language={formLanguage()}
                onChange={(val) => setFormContent(val)}
                style={{ height: "100%" }}
              />
            </div>

            {/* Run hint for JS/TS */}
            <Show when={BENCHABLE_LANGS.has(formLanguage())}>
              <div style={{
                padding: "6px 16px",
                "border-top": "1px solid var(--border-color)",
                "font-size": "10px",
                color: "var(--text-muted)",
                "flex-shrink": "0",
                background: "var(--bg-surface)",
              }}>
                Apres sauvegarde, utilisez le bouton <strong style={{ color: "#00b894" }}>Run</strong> pour benchmarker ce snippet.
              </div>
            </Show>
          </div>
        </Show>

        {/* Detail view */}
        <Show when={!showForm() && sel()}>
          <div style={{ flex: "1", "overflow-y": "auto", padding: "20px 24px" }}>
            {/* Header */}
            <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", "margin-bottom": "16px" }}>
              <div style={{ flex: "1", "min-width": "0" }}>
                <h2 style={{ margin: "0 0 8px", "font-size": "18px", "font-weight": "600", color: "var(--text-primary)" }}>
                  {sel()!.title}
                  <Show when={sel()!.isFavorite}>
                    <span style={{ "margin-left": "8px", "font-size": "14px", color: "var(--accent-secondary)" }}>&#9733;</span>
                  </Show>
                </h2>
                <div style={{ display: "flex", gap: "6px", "align-items": "center", "flex-wrap": "wrap" }}>
                  <span style={{
                    padding: "2px 8px", "font-size": "11px", "border-radius": "var(--radius-sm)",
                    background: "var(--bg-elevated)", color: "var(--text-secondary)",
                    "font-family": "monospace",
                  }}>
                    {sel()!.language}
                  </span>
                  <For each={sel()!.tags}>
                    {(tag) => (
                      <span style={tagChipStyle}>{tag}</span>
                    )}
                  </For>
                  <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                    {new Date(sel()!.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", "margin-left": "12px", "flex-shrink": "0" }}>
                <AiButton size="sm" variant="secondary" onClick={() => askCookia(sel()!)}>
                  Ask Cookia
                </AiButton>
                <Show when={BENCHABLE_LANGS.has(sel()!.language)}>
                  <button
                    onClick={() => runSnippetBench(sel()!)}
                    disabled={benchRunning()}
                    title="Benchmark ce snippet"
                    style={{
                      padding: "6px 12px", "border-radius": "var(--radius-sm)", "font-size": "12px", cursor: "pointer",
                      border: "1px solid var(--border-color)",
                      background: benchRunning() ? "var(--bg-elevated)" : "#00b894",
                      color: benchRunning() ? "var(--text-muted)" : "#fff",
                      transition: "all 0.15s",
                      "min-width": "60px",
                    }}
                  >
                    {benchRunning() ? "..." : "\u25B6 Run"}
                  </button>
                </Show>
                <button
                  onClick={() => handleCopy(sel()!.content)}
                  title={t("snippets.copyContent")}
                  style={{
                    padding: "6px 12px", "border-radius": "var(--radius-sm)", "font-size": "12px", cursor: "pointer",
                    border: "1px solid var(--border-color)",
                    background: copyFeedback() ? "var(--accent-color)" : "var(--bg-surface)",
                    color: copyFeedback() ? "#fff" : "var(--text-secondary)",
                    transition: "all 0.15s",
                    "min-width": "80px",
                  }}
                >
                  {copyFeedback() ? t("snippets.copied") : t("common.copy")}
                </button>
                <button
                  onClick={() => toggleFavorite(sel()!.id)}
                  title={sel()!.isFavorite ? t("snippets.removeFavorite") : t("snippets.addFavorite")}
                  style={{
                    background: "none", border: "1px solid var(--border-color)", cursor: "pointer",
                    "font-size": "16px", padding: "4px 8px", "border-radius": "var(--radius-sm)",
                    color: sel()!.isFavorite ? "var(--accent-secondary)" : "var(--text-muted)",
                    transition: "color 0.15s",
                  }}
                >
                  {sel()!.isFavorite ? "\u2605" : "\u2606"}
                </button>
                <button
                  onClick={() => startEdit(sel()!)}
                  title={t("common.edit")}
                  style={{
                    background: "none", border: "1px solid var(--border-color)", cursor: "pointer",
                    "font-size": "14px", padding: "4px 8px", "border-radius": "var(--radius-sm)",
                    color: "var(--text-secondary)", transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
                >
                  &#10000;
                </button>
                <button
                  onClick={() => handleDelete(sel()!.id)}
                  title={t("common.delete")}
                  style={{
                    background: "none", border: "1px solid var(--border-color)", cursor: "pointer",
                    "font-size": "14px", padding: "4px 8px", "border-radius": "var(--radius-sm)",
                    color: "var(--text-muted)", transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--danger-color, #e74c3c)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                >
                  &#10005;
                </button>
              </div>
            </div>

            {/* Code block */}
            <div style={{
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-md)",
              overflow: "hidden",
              height: "300px",
            }}>
              <MonacoEditor
                value={sel()!.content}
                language={sel()!.language}
                readOnly={true}
              />
            </div>

            {/* Bench result inline */}
            <Show when={benchRunning()}>
              <div style={{ "margin-top": "12px", display: "flex", "align-items": "center", gap: "8px", padding: "10px 14px", background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <CookieLoader size={18} />
                <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>Benchmark en cours...</span>
              </div>
            </Show>
            <Show when={benchResult()}>
              <div style={{ "margin-top": "12px", padding: "10px 14px", background: "color-mix(in srgb, #00b894 8%, transparent)", "border-radius": "var(--radius-md)", border: "1px solid color-mix(in srgb, #00b894 30%, transparent)" }}>
                <div style={{ "font-size": "10px", "font-weight": "600", color: "#00b894", "text-transform": "uppercase", "letter-spacing": "0.5px", "margin-bottom": "4px" }}>Resultat</div>
                <code style={{ "font-size": "12px", color: "var(--text-primary)", "font-family": "'JetBrains Mono', monospace", "word-break": "break-all" }}>{benchResult()}</code>
              </div>
            </Show>
            <Show when={benchError()}>
              <div style={{ "margin-top": "12px", padding: "10px 14px", background: "color-mix(in srgb, #d63031 8%, transparent)", "border-radius": "var(--radius-md)", border: "1px solid color-mix(in srgb, #d63031 30%, transparent)" }}>
                <div style={{ "font-size": "10px", "font-weight": "600", color: "#d63031", "text-transform": "uppercase", "letter-spacing": "0.5px", "margin-bottom": "4px" }}>Erreur</div>
                <code style={{ "font-size": "12px", color: "#d63031", "font-family": "'JetBrains Mono', monospace" }}>{benchError()}</code>
              </div>
            </Show>
          </div>
        </Show>

        {/* Empty state */}
        <Show when={!showForm() && !sel()}>
          <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <div style={{ "text-align": "center", color: "var(--text-muted)" }}>
              <div style={{ "font-size": "32px", "margin-bottom": "8px", opacity: "0.4" }}>&#128203;</div>
              <p style={{ "font-size": "13px", margin: "0" }}>{t("snippets.selectOrCreate")}</p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
