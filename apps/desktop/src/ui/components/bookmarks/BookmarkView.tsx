import { createSignal, For, Show } from "solid-js";
import { useBookmarkStore, BOOKMARK_TAGS, type Bookmark, type BookmarkTag, type CreateBookmarkInput } from "../../../application/stores/bookmarkStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../common/Button";

export function BookmarkView() {
  const { bookmarks, favorites, createBookmark, updateBookmark, deleteBookmark, toggleFavorite } = useBookmarkStore();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [emoji, setEmoji] = createSignal("");
  const [tag, setTag] = createSignal<BookmarkTag>("none");
  const [isFav, setIsFav] = createSignal(false);
  const [filter, setFilter] = createSignal("");
  const [filterTag, setFilterTag] = createSignal<BookmarkTag | "all">("all");

  const filtered = () => {
    let list = bookmarks();
    if (filterTag() !== "all") list = list.filter((b) => b.tag === filterTag());
    const q = filter().toLowerCase();
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
    return list;
  };

  function resetForm() {
    setName(""); setUrl(""); setEmoji(""); setTag("none"); setIsFav(false); setEditing(null); setCreating(false);
  }

  function startCreate() { resetForm(); setCreating(true); }

  function startEdit(b: Bookmark) {
    setName(b.name); setUrl(b.url); setEmoji(b.emoji ?? ""); setTag(b.tag); setIsFav(b.isFavorite); setEditing(b.id); setCreating(false);
  }

  async function handleSave() {
    const n = name().trim();
    const u = url().trim();
    if (!n || !u) return;
    const input: CreateBookmarkInput = { name: n, url: u, emoji: emoji().trim() || null, tag: tag(), isFavorite: isFav() };
    if (creating()) await createBookmark(input);
    else if (editing()) await updateBookmark(editing()!, input);
    resetForm();
  }

  async function handleDelete(id: string) {
    await deleteBookmark(id);
    if (editing() === id) resetForm();
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

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div>
          <h2 style={{ margin: "0", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
            Signets
          </h2>
          <p style={{ margin: "4px 0 0", "font-size": "12px", color: "var(--text-muted)" }}>
            {bookmarks().length} signet{bookmarks().length !== 1 ? "s" : ""} — {favorites().length} favori{favorites().length !== 1 ? "s" : ""}
          </p>
        </div>
        <Show when={!creating() && !editing()}>
          <Button variant="primary" size="sm" onClick={startCreate}>
            + Nouveau signet
          </Button>
        </Show>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", "align-items": "center", "margin-bottom": "16px", "flex-wrap": "wrap" }}>
        <input
          type="text"
          placeholder="Filtrer les signets..."
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          style={{ ...inputStyle, "max-width": "300px" }}
        />
        <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
          <button
            onClick={() => setFilterTag("all")}
            style={{
              padding: "4px 10px", "border-radius": "var(--radius-sm)", "font-size": "11px", cursor: "pointer",
              border: "1px solid var(--border-color)",
              background: filterTag() === "all" ? "var(--accent-color)" : "var(--bg-surface)",
              color: filterTag() === "all" ? "#fff" : "var(--text-secondary)",
            }}
          >Tous</button>
          <For each={BOOKMARK_TAGS.filter((t) => t.value !== "none")}>
            {(t) => (
              <button
                onClick={() => setFilterTag(t.value)}
                style={{
                  padding: "4px 10px", "border-radius": "var(--radius-sm)", "font-size": "11px", cursor: "pointer",
                  border: "1px solid var(--border-color)",
                  background: filterTag() === t.value ? "var(--accent-color)" : "var(--bg-surface)",
                  color: filterTag() === t.value ? "#fff" : "var(--text-secondary)",
                }}
              >{t.label}</button>
            )}
          </For>
        </div>
      </div>

      {/* Create/Edit form */}
      <Show when={creating() || editing()}>
        <div style={{
          "margin-bottom": "20px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--accent-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ display: "flex", gap: "12px", "margin-bottom": "12px" }}>
            <div style={{ flex: "1" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Nom</label>
              <input type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} placeholder="GitHub" style={inputStyle} />
            </div>
            <div style={{ width: "80px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Emoji</label>
              <input type="text" value={emoji()} onInput={(e) => setEmoji(e.currentTarget.value)} placeholder="" maxLength={4} style={{ ...inputStyle, "text-align": "center" }} />
            </div>
          </div>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>URL</label>
            <input type="url" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} placeholder="https://github.com" style={inputStyle} />
          </div>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>Tag</label>
            <select
              value={tag()}
              onChange={(e) => setTag(e.currentTarget.value as BookmarkTag)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <For each={BOOKMARK_TAGS}>
                {(t) => <option value={t.value}>{t.label}</option>}
              </For>
            </select>
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

      {/* Bookmark grid */}
      <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
        <For each={filtered()}>
          {(bookmark) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
              padding: "12px 14px",
              "border-radius": "var(--radius-md)",
              border: editing() === bookmark.id ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
              background: editing() === bookmark.id ? "var(--bg-elevated)" : "var(--bg-surface)",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
              onDblClick={() => openUrl(bookmark.url)}
            >
              <span style={{ "font-size": "20px", "flex-shrink": "0" }}>{bookmark.emoji ?? "🔗"}</span>
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {bookmark.name}
                </div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis", "margin-top": "2px" }}>
                  {bookmark.url}
                </div>
                <Show when={bookmark.tag && bookmark.tag !== "none"}>
                  <span style={{
                    display: "inline-block", "margin-top": "3px", padding: "1px 6px",
                    "font-size": "10px", "border-radius": "var(--radius-sm)",
                    background: "var(--bg-elevated)", color: "var(--text-secondary)",
                  }}>
                    {BOOKMARK_TAGS.find((t) => t.value === bookmark.tag)?.label ?? bookmark.tag}
                  </span>
                </Show>
              </div>
              <div style={{ display: "flex", gap: "2px", "flex-shrink": "0" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(bookmark.id); }}
                  title={bookmark.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "14px", color: bookmark.isFavorite ? "var(--accent-secondary)" : "var(--text-muted)", padding: "4px" }}
                >
                  {bookmark.isFavorite ? "★" : "☆"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(bookmark); }}
                  title="Editer"
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "12px", color: "var(--text-muted)", padding: "4px" }}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(bookmark.id); }}
                  title="Supprimer"
                  style={{ background: "none", border: "none", cursor: "pointer", "font-size": "12px", color: "var(--text-muted)", padding: "4px" }}
                >
                  ✕
                </button>
              </div>
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
