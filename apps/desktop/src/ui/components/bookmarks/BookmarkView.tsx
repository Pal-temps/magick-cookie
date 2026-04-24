import { createSignal, onMount, For, Show } from "solid-js";
import { useBookmarkStore, type Bookmark, type CreateBookmarkInput } from "../../../application/stores/bookmarkStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../common/Button";
import { useT } from "../../../i18n/context";

export function BookmarkView() {
  const store = useBookmarkStore();

  onMount(() => {
    if (store.bookmarks().length === 0) store.fetchBookmarks();
  });
  const { bookmarks, favorites, categories, createBookmark, updateBookmark, deleteBookmark, toggleFavorite, createCategory, updateCategory: updateCategoryApi, deleteCategory: deleteCategoryApi } = store;
  const { t } = useT();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [emoji, setEmoji] = createSignal("");
  const [category, setCategory] = createSignal("none");
  const [isFav, setIsFav] = createSignal(false);

  // Use shared filter signals from the store (controlled by sidebar)
  const filter = store.filterQuery;
  const filterCategory = store.filterCategory;
  const [emojiPickerOpen, setEmojiPickerOpen] = createSignal(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = createSignal(false);

  const [showCategorySettings, setShowCategorySettings] = createSignal(false);
  const [editingCategory, setEditingCategory] = createSignal<string | null>(null);
  const [newCategoryValue, setNewCategoryValue] = createSignal("");
  const [newCategoryLabel, setNewCategoryLabel] = createSignal("");

  const EMOJI_PRESETS = ["🔗", "📖", "🛠️", "📝", "🎬", "💡", "📌", "🏠", "💻", "📊", "🎨", "🔒", "🎵", "📧", "🔍", "⚡", "🎯", "📁", "🌐", "🛒"];

  const filtered = () => {
    let list = bookmarks();
    if (filterCategory() !== "all") list = list.filter((b) => b.category === filterCategory());
    const q = filter().toLowerCase();
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
    return list;
  };

  function resetForm() {
    setName(""); setUrl(""); setEmoji(""); setCategory("none"); setIsFav(false); setEmojiPickerOpen(false); setCategoryDropdownOpen(false); setEditing(null); setCreating(false);
  }

  function startCreate() { resetForm(); setCreating(true); }

  function startEdit(b: Bookmark) {
    setName(b.name); setUrl(b.url); setEmoji(b.emoji ?? ""); setCategory(b.category ?? "none"); setIsFav(b.isFavorite); setEditing(b.id); setCreating(false);
  }

  async function handleSave() {
    const n = name().trim();
    const u = url().trim();
    if (!n || !u) return;
    const input: CreateBookmarkInput = { name: n, url: u, emoji: emoji().trim() || null, category: category(), isFavorite: isFav() };
    if (creating()) await createBookmark(input);
    else if (editing()) await updateBookmark(editing()!, input);
    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteBookmark(id);
    if (editing() === id) resetForm();
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
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box" as const,
    "color-scheme": "dark",
  };

  return (
    <div style={{ height: "100%", overflow: "auto", "overflow-x": "hidden", padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div>
          <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
            {t("bookmarks.title")}
          </h2>
          <p style={{ margin: "4px 0 0", "font-size": "12px", color: "var(--text-muted)" }}>
            {bookmarks().length} {t("bookmarks.count")}{bookmarks().length !== 1 ? "s" : ""} — {favorites().length} favori{favorites().length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", "align-items": "center" }}>
          <button
            onClick={() => setShowCategorySettings(!showCategorySettings())}
            title="Gerer les categories"
            style={{
              padding: "6px 8px", "border-radius": "var(--radius-sm)", "font-size": "16px", cursor: "pointer",
              border: "1px solid var(--border-color)",
              background: showCategorySettings() ? "var(--accent-color)" : "var(--bg-surface)",
              color: showCategorySettings() ? "#fff" : "var(--text-secondary)",
              "line-height": "1",
            }}
          >&#9881;</button>
          <Show when={!creating() && !editing()}>
            <Button variant="primary" size="sm" onClick={startCreate}>
              + Nouveau signet
            </Button>
          </Show>
        </div>
      </div>

      {/* Filters moved to global sidebar (NotesSidebarContent) */}

      {/* Category settings panel */}
      <Show when={showCategorySettings()}>
        <div style={{
          "margin-bottom": "16px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
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
                <input type="text" placeholder="dev" value={newCategoryValue()} onInput={(e) => setNewCategoryValue(e.currentTarget.value)} style={inputStyle} />
              </div>
              <div style={{ flex: "1" }}>
                <label style={{ display: "block", "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "2px" }}>Label</label>
                <input type="text" placeholder="Developpement" value={newCategoryLabel()} onInput={(e) => setNewCategoryLabel(e.currentTarget.value)} style={inputStyle} />
              </div>
              <Button variant="primary" size="sm" onClick={handleAddCategory}>Ajouter</Button>
            </div>
        </div>
      </Show>

      {/* Create/Edit form */}
      <Show when={creating() || editing()}>
        <div style={{
          "margin-bottom": "20px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--accent-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ display: "flex", gap: "12px", "margin-bottom": "12px", "flex-wrap": "wrap" }}>
            <div style={{ width: "100px", "flex-shrink": "0", position: "relative" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Emoji</label>
              <button
                type="button"
                onClick={() => setEmojiPickerOpen(!emojiPickerOpen())}
                style={{
                  ...inputStyle,
                  "font-size": "20px",
                  "text-align": "center",
                  cursor: "pointer",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "4px",
                  height: "36px",
                }}
              >
                <span>{emoji() || "🔗"}</span>
                <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>▼</span>
              </button>
              <Show when={emojiPickerOpen()}>
                {/* Backdrop invisible pour fermer */}
                <div onClick={() => setEmojiPickerOpen(false)} style={{ position: "fixed", inset: "0", "z-index": "99" }} />
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "0",
                  "margin-top": "4px",
                  padding: "8px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  "border-radius": "var(--radius-md)",
                  "box-shadow": "0 4px 12px rgba(0,0,0,0.15)",
                  "z-index": "100",
                  display: "grid",
                  "grid-template-columns": "repeat(5, 36px)",
                  gap: "2px",
                }}>
                  <For each={EMOJI_PRESETS}>
                    {(e) => (
                      <button
                        type="button"
                        onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                        style={{
                          background: emoji() === e ? "var(--accent-color)" : "none",
                          border: "none",
                          "border-radius": "var(--radius-sm)",
                          cursor: "pointer",
                          "font-size": "18px",
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "center",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(ev) => { if (emoji() !== e) ev.currentTarget.style.background = "var(--bg-elevated)"; }}
                        onMouseLeave={(ev) => { if (emoji() !== e) ev.currentTarget.style.background = "none"; }}
                      >{e}</button>
                    )}
                  </For>
                  {/* Custom input en dernière row, pleine largeur */}
                  <div style={{ "grid-column": "1 / -1", "border-top": "1px solid var(--border-color)", "margin-top": "4px", "padding-top": "6px" }}>
                    <input
                      type="text"
                      value={emoji()}
                      onInput={(e) => setEmoji(e.currentTarget.value)}
                      placeholder="Custom..."
                      maxLength={4}
                      style={{ ...inputStyle, "text-align": "center", "font-size": "14px" }}
                      onKeyDown={(e) => { if (e.key === "Enter") setEmojiPickerOpen(false); }}
                    />
                  </div>
                </div>
              </Show>
            </div>
            <div style={{ flex: "1", "min-width": "150px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Nom</label>
              <input type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} placeholder="GitHub" style={inputStyle} />
            </div>
          </div>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>URL</label>
            <input type="url" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} placeholder="https://github.com" style={inputStyle} />
          </div>
          {/* Category dropdown */}
          <div style={{ "margin-bottom": "12px", position: "relative" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Categorie</label>
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen())}
              style={{
                ...inputStyle,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                height: "34px",
              }}
            >
              <span>{category() === "none" ? "Aucune" : (categories().find((c) => c.value === category())?.label ?? category())}</span>
              <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>&#9660;</span>
            </button>
            <Show when={categoryDropdownOpen()}>
              <div onClick={() => setCategoryDropdownOpen(false)} style={{ position: "fixed", inset: "0", "z-index": "99" }} />
              <div style={{
                position: "absolute",
                top: "100%",
                left: "0",
                right: "0",
                "margin-top": "4px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                "border-radius": "var(--radius-md)",
                "box-shadow": "0 4px 12px rgba(0,0,0,0.15)",
                "z-index": "100",
                overflow: "hidden",
              }}>
                <button
                  type="button"
                  onClick={() => { setCategory("none"); setCategoryDropdownOpen(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    background: category() === "none" ? "var(--accent-color)" : "transparent",
                    color: category() === "none" ? "#fff" : "var(--text-primary)",
                    "font-size": "13px",
                    cursor: "pointer",
                    "text-align": "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (category() !== "none") e.currentTarget.style.background = "var(--bg-elevated)"; }}
                  onMouseLeave={(e) => { if (category() !== "none") e.currentTarget.style.background = "transparent"; }}
                >Aucune</button>
                <For each={categories()}>
                  {(c) => (
                    <button
                      type="button"
                      onClick={() => { setCategory(c.value); setCategoryDropdownOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        background: category() === c.value ? "var(--accent-color)" : "transparent",
                        color: category() === c.value ? "#fff" : "var(--text-primary)",
                        "font-size": "13px",
                        cursor: "pointer",
                        "text-align": "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { if (category() !== c.value) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                      onMouseLeave={(e) => { if (category() !== c.value) e.currentTarget.style.background = "transparent"; }}
                    >{c.label}</button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-top": "4px" }}>
            <label style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isFav()}
                onChange={(e) => setIsFav(e.currentTarget.checked)}
                style={{ cursor: "pointer" }}
              />
              Favori (visible dans la sidebar)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="ghost" size="sm" onClick={resetForm}>Annuler</Button>
              <Button variant="primary" size="sm" onClick={handleSave}>{creating() ? "Creer" : "Enregistrer"}</Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Bookmark list */}
      <div style={{ display: "flex", "flex-direction": "column", "min-width": "0" }}>
        {/* Table header */}
        <div style={{
          display: "flex", "align-items": "center", padding: "4px 10px",
          "font-size": "10px", "font-weight": "600", color: "var(--text-muted)", "text-transform": "uppercase",
          "border-bottom": "2px solid var(--border-color)",
        }}>
          <span style={{ width: "24px", "flex-shrink": "0" }} />
          <span style={{ flex: "2", "min-width": "0" }}>Nom</span>
          <span style={{ flex: "3", "min-width": "0" }}>URL</span>
          <span style={{ flex: "1", "min-width": "0" }}>Categorie</span>
          <span style={{ width: "80px", "flex-shrink": "0", "text-align": "right" }} />
        </div>

        <For each={filtered()}>
          {(bookmark) => (
            <div
              style={{
                display: "flex", "align-items": "center", padding: "4px 10px",
                "border-bottom": "1px solid var(--border-color)",
                background: editing() === bookmark.id ? "var(--bg-elevated)" : "transparent",
                cursor: "pointer", transition: "background 0.1s",
              }}
              onDblClick={() => openUrl(bookmark.url)}
              onMouseEnter={(e) => { if (editing() !== bookmark.id) e.currentTarget.style.background = "var(--bg-surface)"; }}
              onMouseLeave={(e) => { if (editing() !== bookmark.id) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ "font-size": "13px", width: "24px", "flex-shrink": "0", "text-align": "center" }}>{bookmark.emoji ?? "🔗"}</span>
              <span style={{ flex: "2", "min-width": "0", "font-size": "12px", "font-weight": "500", color: "var(--text-primary)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis", "padding-right": "8px" }}>
                {bookmark.name}
                <Show when={bookmark.isFavorite}>
                  <span style={{ "margin-left": "6px", "font-size": "12px", color: "var(--accent-secondary)" }}>★</span>
                </Show>
              </span>
              <span style={{ flex: "3", "min-width": "0", "font-size": "12px", color: "var(--text-muted)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis", "padding-right": "8px" }}>
                {bookmark.url}
              </span>
              <span style={{ flex: "1", "min-width": "0" }}>
                <Show when={bookmark.category && bookmark.category !== "none"}>
                  <span style={{ padding: "2px 6px", "font-size": "10px", "border-radius": "var(--radius-sm)", background: "var(--accent-color)", color: "#fff", "white-space": "nowrap", opacity: "0.8" }}>
                    {categories().find((c) => c.value === bookmark.category)?.label ?? bookmark.category}
                  </span>
                </Show>
              </span>
              <span style={{ width: "80px", "flex-shrink": "0", display: "flex", gap: "4px", "justify-content": "flex-end" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(bookmark.id); }}
                  title={bookmark.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "18px", color: bookmark.isFavorite ? "var(--accent-secondary)" : "var(--text-muted)", padding: "2px", "border-radius": "var(--radius-sm)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  {bookmark.isFavorite ? "★" : "☆"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(bookmark); }}
                  title="Editer"
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "16px", color: "var(--text-muted)", padding: "2px", "border-radius": "var(--radius-sm)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(bookmark.id); }}
                  title="Supprimer"
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "16px", color: "var(--text-muted)", padding: "2px", "border-radius": "var(--radius-sm)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--danger-color, #e74c3c)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  ✕
                </button>
              </span>
            </div>
          )}
        </For>
      </div>

      <Show when={filtered().length === 0 && bookmarks().length > 0}>
        <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "20px 0", "text-align": "center" }}>
          Aucun signet ne correspond au filtre.
        </div>
      </Show>

      <Show when={bookmarks().length === 0}>
        <div style={{ "font-size": "13px", color: "var(--text-muted)", padding: "40px 0", "text-align": "center" }}>
          Aucun signet. Cliquez sur "+ Nouveau signet" pour commencer.
        </div>
      </Show>
    </div>
  );
}
