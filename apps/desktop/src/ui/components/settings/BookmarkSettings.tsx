import { createSignal, For, Show } from "solid-js";
import { useBookmarkStore, type CreateBookmarkInput } from "../../../application/stores/bookmarkStore";
import { Button } from "../common/Button";

export function BookmarkSettings() {
  const { bookmarks, createBookmark, updateBookmark, deleteBookmark, toggleFavorite } = useBookmarkStore();
  const [editing, setEditing] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [emoji, setEmoji] = createSignal("");

  function resetForm() {
    setName("");
    setUrl("");
    setEmoji("");
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  function startEdit(id: string) {
    const b = bookmarks().find((b) => b.id === id);
    if (!b) return;
    setName(b.name);
    setUrl(b.url);
    setEmoji(b.emoji ?? "");
    setEditing(id);
    setCreating(false);
  }

  async function handleSave() {
    const n = name().trim();
    const u = url().trim();
    if (!n || !u) return;

    const input: CreateBookmarkInput = { name: n, url: u, emoji: emoji().trim() || null };

    if (creating()) {
      await createBookmark(input);
    } else if (editing()) {
      await updateBookmark(editing()!, input);
    }
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
    <div style={{ padding: "24px", "max-width": "700px" }}>
      <h3 style={{ margin: "0 0 4px", "font-size": "16px", "font-weight": "600", color: "var(--text-primary)" }}>
        Signets
      </h3>
      <p style={{ margin: "0 0 20px", "font-size": "12px", color: "var(--text-muted)" }}>
        Gerez vos signets. Les favoris apparaissent dans la sidebar.
      </p>

      {/* List */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-bottom": "16px" }}>
        <For each={bookmarks()}>
          {(bookmark) => (
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "10px 12px",
              "border-radius": "var(--radius-md)",
              border: editing() === bookmark.id ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
              background: editing() === bookmark.id ? "var(--bg-elevated)" : "transparent",
            }}>
              <span style={{ "font-size": "16px", "flex-shrink": "0" }}>{bookmark.emoji ?? "🔗"}</span>
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>
                  {bookmark.name}
                </div>
                <div style={{
                  "font-size": "11px",
                  color: "var(--text-muted)",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "margin-top": "2px",
                }}>
                  {bookmark.url}
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
                <button
                  onClick={() => toggleFavorite(bookmark.id)}
                  title={bookmark.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    "font-size": "14px",
                    color: bookmark.isFavorite ? "var(--accent-secondary)" : "var(--text-muted)",
                    padding: "4px 6px",
                  }}
                >
                  {bookmark.isFavorite ? "★" : "☆"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(bookmark.id)}>
                  Editer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(bookmark.id)}>
                  Suppr.
                </Button>
              </div>
            </div>
          )}
        </For>

        <Show when={bookmarks().length === 0}>
          <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "12px 0" }}>
            Aucun signet. Cliquez sur "+ Nouveau signet" pour commencer.
          </div>
        </Show>
      </div>

      {/* Add button */}
      <Show when={!creating() && !editing()}>
        <Button variant="secondary" size="sm" onClick={startCreate}>
          + Nouveau signet
        </Button>
      </Show>

      {/* Edit / Create form */}
      <Show when={creating() || editing()}>
        <div style={{
          "margin-top": "16px",
          padding: "16px",
          "border-radius": "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
        }}>
          <div style={{ display: "flex", gap: "12px", "margin-bottom": "12px" }}>
            <div style={{ flex: "1" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
                Nom
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="GitHub"
                style={inputStyle}
              />
            </div>
            <div style={{ width: "80px" }}>
              <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
                Emoji
              </label>
              <input
                type="text"
                value={emoji()}
                onInput={(e) => setEmoji(e.currentTarget.value)}
                placeholder="🔗"
                maxLength={4}
                style={{ ...inputStyle, "text-align": "center" }}
              />
            </div>
          </div>
          <div style={{ "margin-bottom": "12px" }}>
            <label style={{ display: "block", "font-size": "12px", "font-weight": "500", color: "var(--text-secondary)", "margin-bottom": "4px" }}>
              URL
            </label>
            <input
              type="url"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              placeholder="https://github.com"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Annuler
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave}>
              {creating() ? "Creer" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
