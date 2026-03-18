import { createSignal, For, Show, createMemo } from "solid-js";
import { useSnippetStore, type Snippet, type CreateSnippetInput } from "../../../application/stores/snippetStore";
import { Button } from "../common/Button";

const LANGUAGES = [
  "text", "bash", "javascript", "typescript", "python", "sql", "css", "html",
  "json", "yaml", "docker", "go", "rust", "java", "csharp", "php", "ruby",
  "swift", "kotlin", "markdown", "xml", "toml", "ini", "powershell", "lua",
];

export function SnippetView() {
  const {
    snippets, categories, favorites, selectedSnippet, setSelectedSnippet,
    createSnippet, updateSnippet, deleteSnippet, toggleFavorite,
    createCategory, updateCategory: updateCategoryApi, deleteCategory: deleteCategoryApi,
  } = useSnippetStore();

  const [filter, setFilter] = createSignal("");
  const [filterCategory, setFilterCategory] = createSignal<string>("all");
  const [filterFavorites, setFilterFavorites] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [showCategorySettings, setShowCategorySettings] = createSignal(false);
  const [copyFeedback, setCopyFeedback] = createSignal(false);

  // Form fields
  const [formTitle, setFormTitle] = createSignal("");
  const [formContent, setFormContent] = createSignal("");
  const [formLanguage, setFormLanguage] = createSignal("text");
  const [formCategory, setFormCategory] = createSignal("none");
  const [formFavorite, setFormFavorite] = createSignal(false);

  // Category management
  const [editingCategory, setEditingCategory] = createSignal<string | null>(null);
  const [newCategoryValue, setNewCategoryValue] = createSignal("");
  const [newCategoryLabel, setNewCategoryLabel] = createSignal("");

  const filtered = createMemo(() => {
    let list = snippets();
    if (filterFavorites()) list = list.filter((s) => s.isFavorite);
    if (filterCategory() !== "all") list = list.filter((s) => s.category === filterCategory());
    const q = filter().toLowerCase();
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || s.language.toLowerCase().includes(q));
    return list;
  });

  function resetForm() {
    setFormTitle(""); setFormContent(""); setFormLanguage("text"); setFormCategory("none"); setFormFavorite(false);
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
    setFormCategory(s.category || "none");
    setFormFavorite(s.isFavorite);
    setEditingId(s.id);
    setShowForm(true);
  }

  async function handleSave() {
    const t = formTitle().trim();
    const c = formContent();
    if (!t) return;
    const input: CreateSnippetInput = {
      title: t,
      content: c,
      language: formLanguage(),
      category: formCategory(),
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

  function handleContentKeyDown(e: KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = formContent();
      setFormContent(val.substring(0, start) + "  " + val.substring(end));
      // Restore cursor position after SolidJS re-renders
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }

  async function handleAddCategory() {
    const v = newCategoryValue().trim();
    const l = newCategoryLabel().trim();
    if (!v || !l) return;
    await createCategory({ value: v, label: l });
    setNewCategoryValue("");
    setNewCategoryLabel("");
  }

  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    "border-radius": "var(--radius-sm)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box" as const,
  };

  const sel = () => selectedSnippet();

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Left panel — categories */}
      <div style={{
        width: "200px",
        "min-width": "200px",
        "border-right": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
        background: "var(--bg-surface)",
      }}>
        <div style={{ padding: "12px", display: "flex", "align-items": "center", "justify-content": "space-between", "border-bottom": "1px solid var(--border-color)" }}>
          <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)", "text-transform": "uppercase" }}>Categories</span>
          <button
            onClick={() => setShowCategorySettings(!showCategorySettings())}
            title="Gerer les categories"
            style={{
              padding: "4px 6px", "border-radius": "var(--radius-sm)", "font-size": "14px", cursor: "pointer",
              border: "1px solid var(--border-color)",
              background: showCategorySettings() ? "var(--accent-color)" : "var(--bg-surface)",
              color: showCategorySettings() ? "#fff" : "var(--text-secondary)",
              "line-height": "1",
            }}
          >&#9881;</button>
        </div>

        <div style={{ flex: "1", "overflow-y": "auto", padding: "8px" }}>
          {/* "Tous" filter */}
          <button
            onClick={() => { setFilterCategory("all"); setFilterFavorites(false); }}
            style={{
              display: "block", width: "100%", padding: "6px 10px", "margin-bottom": "2px",
              "border-radius": "var(--radius-sm)", "font-size": "12px", cursor: "pointer",
              border: "none", "text-align": "left",
              background: filterCategory() === "all" && !filterFavorites() ? "var(--accent-color)" : "transparent",
              color: filterCategory() === "all" && !filterFavorites() ? "#fff" : "var(--text-primary)",
              "font-weight": filterCategory() === "all" && !filterFavorites() ? "600" : "normal",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { if (filterCategory() !== "all" || filterFavorites()) e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onMouseLeave={(e) => { if (filterCategory() !== "all" || filterFavorites()) e.currentTarget.style.background = "transparent"; }}
          >
            Tous
            <span style={{ "margin-left": "6px", "font-size": "10px", color: filterCategory() === "all" && !filterFavorites() ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
              {snippets().length}
            </span>
          </button>

          {/* Favorites filter */}
          <button
            onClick={() => { setFilterFavorites(true); setFilterCategory("all"); }}
            style={{
              display: "block", width: "100%", padding: "6px 10px", "margin-bottom": "2px",
              "border-radius": "var(--radius-sm)", "font-size": "12px", cursor: "pointer",
              border: "none", "text-align": "left",
              background: filterFavorites() ? "var(--accent-color)" : "transparent",
              color: filterFavorites() ? "#fff" : "var(--text-primary)",
              "font-weight": filterFavorites() ? "600" : "normal",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { if (!filterFavorites()) e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onMouseLeave={(e) => { if (!filterFavorites()) e.currentTarget.style.background = "transparent"; }}
          >
            &#9733; Favoris
            <span style={{ "margin-left": "6px", "font-size": "10px", color: filterFavorites() ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
              {favorites().length}
            </span>
          </button>

          <div style={{ height: "1px", background: "var(--border-color)", margin: "6px 0" }} />

          <For each={categories()}>
            {(cat) => (
              <button
                onClick={() => { setFilterCategory(cat.value); setFilterFavorites(false); }}
                style={{
                  display: "block", width: "100%", padding: "6px 10px", "margin-bottom": "2px",
                  "border-radius": "var(--radius-sm)", "font-size": "12px", cursor: "pointer",
                  border: "none", "text-align": "left",
                  background: filterCategory() === cat.value && !filterFavorites() ? "var(--accent-color)" : "transparent",
                  color: filterCategory() === cat.value && !filterFavorites() ? "#fff" : "var(--text-primary)",
                  "font-weight": filterCategory() === cat.value && !filterFavorites() ? "600" : "normal",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (filterCategory() !== cat.value || filterFavorites()) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { if (filterCategory() !== cat.value || filterFavorites()) e.currentTarget.style.background = "transparent"; }}
              >
                {cat.label}
                <span style={{ "margin-left": "6px", "font-size": "10px", color: filterCategory() === cat.value && !filterFavorites() ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
                  {snippets().filter((s) => s.category === cat.value).length}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Center panel — snippet list */}
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
            placeholder="Rechercher..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            style={{ ...inputStyle, flex: "1" }}
          />
          <Button variant="primary" size="sm" onClick={startCreate}>+ Nouveau</Button>
        </div>

        {/* List */}
        <div style={{ flex: "1", "overflow-y": "auto" }}>
          <For each={filtered()}>
            {(snippet) => (
              <div
                onClick={() => setSelectedSnippet(snippet)}
                style={{
                  padding: "10px 12px",
                  "border-bottom": "1px solid var(--border-color)",
                  cursor: "pointer",
                  background: sel()?.id === snippet.id ? "var(--bg-elevated)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (sel()?.id !== snippet.id) e.currentTarget.style.background = "var(--bg-surface)"; }}
                onMouseLeave={(e) => { if (sel()?.id !== snippet.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-bottom": "4px" }}>
                  <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)", flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {snippet.title}
                  </span>
                  <Show when={snippet.isFavorite}>
                    <span style={{ "font-size": "12px", color: "var(--accent-secondary)" }}>&#9733;</span>
                  </Show>
                </div>
                <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
                  <span style={{
                    padding: "1px 6px", "font-size": "10px", "border-radius": "var(--radius-sm)",
                    background: "var(--bg-elevated)", color: "var(--text-secondary)",
                    "font-family": "monospace",
                  }}>
                    {snippet.language}
                  </span>
                  <Show when={snippet.category && snippet.category !== "none"}>
                    <span style={{
                      padding: "1px 6px", "font-size": "10px", "border-radius": "var(--radius-sm)",
                      background: "var(--accent-color)", color: "#fff", opacity: "0.8",
                    }}>
                      {categories().find((c) => c.value === snippet.category)?.label ?? snippet.category}
                    </span>
                  </Show>
                </div>
              </div>
            )}
          </For>

          <Show when={filtered().length === 0 && snippets().length > 0}>
            <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "20px", "text-align": "center" }}>
              Aucun snippet ne correspond au filtre.
            </div>
          </Show>

          <Show when={snippets().length === 0}>
            <div style={{ "font-size": "13px", color: "var(--text-muted)", padding: "40px 20px", "text-align": "center" }}>
              Aucun snippet. Cliquez sur "+ Nouveau" pour commencer.
            </div>
          </Show>
        </div>
      </div>

      {/* Right panel — detail / form / category settings */}
      <div style={{ flex: "1.2", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
        {/* Category settings overlay */}
        <Show when={showCategorySettings()}>
          <div style={{
            padding: "16px",
            "border-bottom": "1px solid var(--border-color)",
            background: "var(--bg-elevated)",
            "overflow-y": "auto",
            "max-height": "50%",
          }}>
            <h3 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>Gestion des categories</h3>
            <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "12px" }}>
              <For each={categories()}>
                {(c) => (
                  <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <span style={{ "font-size": "12px", color: "var(--text-muted)", "min-width": "100px" }}>{c.value}</span>
                    <Show when={editingCategory() === c.id} fallback={
                      <span
                        style={{ flex: "1", "font-size": "13px", color: "var(--text-primary)", cursor: "pointer", padding: "4px 8px", "border-radius": "var(--radius-sm)" }}
                        onDblClick={() => setEditingCategory(c.id)}
                        title="Double-cliquer pour modifier"
                      >{c.label}</span>
                    }>
                      <input
                        type="text"
                        value={c.label}
                        style={{ ...inputStyle, flex: "1" }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            await updateCategoryApi(c.id, { label: e.currentTarget.value.trim() });
                            setEditingCategory(null);
                          } else if (e.key === "Escape") {
                            setEditingCategory(null);
                          }
                        }}
                        onBlur={async (e) => {
                          const newLabel = e.currentTarget.value.trim();
                          if (newLabel && newLabel !== c.label) {
                            await updateCategoryApi(c.id, { label: newLabel });
                          }
                          setEditingCategory(null);
                        }}
                        ref={(el) => setTimeout(() => el.focus(), 0)}
                      />
                    </Show>
                    <button
                      onClick={() => deleteCategoryApi(c.id)}
                      title="Supprimer cette categorie"
                      style={{
                        background: "none", border: "none", cursor: "pointer", "font-size": "14px",
                        color: "var(--text-muted)", padding: "2px 4px", "border-radius": "var(--radius-sm)",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--danger-color, #e74c3c)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                    >&#10005;</button>
                  </div>
                )}
              </For>
            </div>
            <div style={{ display: "flex", gap: "8px", "align-items": "flex-end", "border-top": "1px solid var(--border-color)", "padding-top": "12px" }}>
              <div style={{ flex: "1" }}>
                <label style={{ display: "block", "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "2px" }}>Valeur</label>
                <input type="text" placeholder="shell" value={newCategoryValue()} onInput={(e) => setNewCategoryValue(e.currentTarget.value)} style={inputStyle} />
              </div>
              <div style={{ flex: "1" }}>
                <label style={{ display: "block", "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "2px" }}>Label</label>
                <input type="text" placeholder="Shell / CLI" value={newCategoryLabel()} onInput={(e) => setNewCategoryLabel(e.currentTarget.value)} style={inputStyle} />
              </div>
              <Button variant="primary" size="sm" onClick={handleAddCategory}>Ajouter</Button>
            </div>
          </div>
        </Show>

        {/* Create/Edit form */}
        <Show when={showForm()}>
          <div style={{
            padding: "16px",
            "border-bottom": "1px solid var(--accent-color)",
            background: "var(--bg-elevated)",
            "overflow-y": "auto",
            flex: "1",
          }}>
            <h3 style={{ margin: "0 0 12px", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
              {editingId() ? "Modifier le snippet" : "Nouveau snippet"}
            </h3>
            <div style={{ "margin-bottom": "10px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Titre</label>
              <input type="text" value={formTitle()} onInput={(e) => setFormTitle(e.currentTarget.value)} placeholder="Mon snippet..." style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: "10px", "margin-bottom": "10px" }}>
              <div style={{ flex: "1" }}>
                <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Langage</label>
                <select
                  value={formLanguage()}
                  onChange={(e) => setFormLanguage(e.currentTarget.value)}
                  style={{ ...inputStyle, cursor: "pointer", height: "32px" }}
                >
                  <For each={LANGUAGES}>
                    {(lang) => <option value={lang}>{lang}</option>}
                  </For>
                </select>
              </div>
              <div style={{ flex: "1" }}>
                <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Categorie</label>
                <select
                  value={formCategory()}
                  onChange={(e) => setFormCategory(e.currentTarget.value)}
                  style={{ ...inputStyle, cursor: "pointer", height: "32px" }}
                >
                  <option value="none">Aucune</option>
                  <For each={categories()}>
                    {(c) => <option value={c.value}>{c.label}</option>}
                  </For>
                </select>
              </div>
            </div>
            <div style={{ "margin-bottom": "10px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Contenu</label>
              <textarea
                value={formContent()}
                onInput={(e) => setFormContent(e.currentTarget.value)}
                onKeyDown={handleContentKeyDown}
                placeholder="Collez ou tapez votre code ici..."
                style={{
                  ...inputStyle,
                  "font-family": "monospace",
                  "font-size": "12px",
                  "line-height": "1.5",
                  "min-height": "200px",
                  resize: "vertical",
                  "white-space": "pre",
                  "tab-size": "2",
                }}
              />
            </div>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
              <label style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formFavorite()}
                  onChange={(e) => setFormFavorite(e.currentTarget.checked)}
                  style={{ cursor: "pointer" }}
                />
                Favori
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="ghost" size="sm" onClick={resetForm}>Annuler</Button>
                <Button variant="primary" size="sm" onClick={handleSave}>{editingId() ? "Enregistrer" : "Creer"}</Button>
              </div>
            </div>
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
                <div style={{ display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" }}>
                  <span style={{
                    padding: "2px 8px", "font-size": "11px", "border-radius": "var(--radius-sm)",
                    background: "var(--bg-elevated)", color: "var(--text-secondary)",
                    "font-family": "monospace",
                  }}>
                    {sel()!.language}
                  </span>
                  <Show when={sel()!.category && sel()!.category !== "none"}>
                    <span style={{
                      padding: "2px 8px", "font-size": "11px", "border-radius": "var(--radius-sm)",
                      background: "var(--accent-color)", color: "#fff", opacity: "0.8",
                    }}>
                      {categories().find((c) => c.value === sel()!.category)?.label ?? sel()!.category}
                    </span>
                  </Show>
                  <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                    {new Date(sel()!.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", "margin-left": "12px", "flex-shrink": "0" }}>
                <button
                  onClick={() => handleCopy(sel()!.content)}
                  title="Copier le contenu"
                  style={{
                    padding: "6px 12px", "border-radius": "var(--radius-sm)", "font-size": "12px", cursor: "pointer",
                    border: "1px solid var(--border-color)",
                    background: copyFeedback() ? "var(--accent-color)" : "var(--bg-surface)",
                    color: copyFeedback() ? "#fff" : "var(--text-secondary)",
                    transition: "all 0.15s",
                    "min-width": "80px",
                  }}
                >
                  {copyFeedback() ? "Copie !" : "Copier"}
                </button>
                <button
                  onClick={() => toggleFavorite(sel()!.id)}
                  title={sel()!.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
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
                  title="Modifier"
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
                  title="Supprimer"
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
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              "border-radius": "var(--radius-md)",
              overflow: "auto",
            }}>
              <pre style={{
                margin: "0",
                padding: "16px",
                "font-family": "monospace",
                "font-size": "13px",
                "line-height": "1.6",
                color: "var(--text-primary)",
                "white-space": "pre-wrap",
                "word-break": "break-word",
                "tab-size": "2",
              }}>
                <code>{sel()!.content}</code>
              </pre>
            </div>
          </div>
        </Show>

        {/* Empty state */}
        <Show when={!showForm() && !sel()}>
          <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <div style={{ "text-align": "center", color: "var(--text-muted)" }}>
              <div style={{ "font-size": "32px", "margin-bottom": "8px", opacity: "0.4" }}>&#128203;</div>
              <p style={{ "font-size": "13px", margin: "0" }}>Selectionnez un snippet ou creez-en un nouveau.</p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
