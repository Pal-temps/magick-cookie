import { createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../infrastructure/api/apiClient";

export interface Bookmark {
  id: string;
  name: string;
  url: string;
  emoji: string | null;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkInput {
  name: string;
  url: string;
  emoji?: string | null;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateBookmarkInput {
  name?: string;
  url?: string;
  emoji?: string | null;
  isFavorite?: boolean;
  sortOrder?: number;
}

const [bookmarks, setBookmarks] = createSignal<Bookmark[]>([]);

export function useBookmarkStore() {
  const favorites = createMemo(() => bookmarks().filter((b) => b.isFavorite));

  async function fetchBookmarks() {
    try {
      const data = await api.get<Bookmark[]>("/bookmarks");
      setBookmarks(data);
      syncBookmarksToVault();
    } catch (e) {
      console.error("Failed to fetch bookmarks:", e);
    }
  }

  async function createBookmark(input: CreateBookmarkInput) {
    try {
      const bookmark = await api.post<Bookmark>("/bookmarks", input);
      setBookmarks((prev) => [...prev, bookmark]);
      syncBookmarksToVault();
      return bookmark;
    } catch (e) {
      console.error("Failed to create bookmark:", e);
    }
  }

  async function updateBookmark(id: string, input: UpdateBookmarkInput) {
    try {
      const bookmark = await api.put<Bookmark>(`/bookmarks/${id}`, input);
      setBookmarks((prev) => prev.map((b) => (b.id === id ? bookmark : b)));
      syncBookmarksToVault();
      return bookmark;
    } catch (e) {
      console.error("Failed to update bookmark:", e);
    }
  }

  async function deleteBookmark(id: string) {
    try {
      await api.delete(`/bookmarks/${id}`);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      syncBookmarksToVault();
    } catch (e) {
      console.error("Failed to delete bookmark:", e);
    }
  }

  async function toggleFavorite(id: string) {
    const bookmark = bookmarks().find((b) => b.id === id);
    if (bookmark) {
      await updateBookmark(id, { isFavorite: !bookmark.isFavorite });
    }
  }

  /** Write a _bookmarks/bookmarks.md file in the notes vault (git-synced) */
  async function syncBookmarksToVault() {
    try {
      const all = bookmarks();
      if (all.length === 0) {
        await invoke("notes_save", { path: "_bookmarks/bookmarks.md", content: "# Signets\n\nAucun signet.\n" });
        return;
      }

      const favs = all.filter((b) => b.isFavorite);
      const others = all.filter((b) => !b.isFavorite);

      const lines: string[] = ["# Signets", ""];

      if (favs.length > 0) {
        lines.push("## Favoris", "");
        for (const b of favs) {
          lines.push(`- ${b.emoji ? b.emoji + " " : ""}[${b.name}](${b.url})`);
        }
        lines.push("");
      }

      if (others.length > 0) {
        lines.push("## Autres", "");
        for (const b of others) {
          lines.push(`- ${b.emoji ? b.emoji + " " : ""}[${b.name}](${b.url})`);
        }
        lines.push("");
      }

      await invoke("notes_save", { path: "_bookmarks/bookmarks.md", content: lines.join("\n") });
    } catch {
      // Vault not configured — silently skip
    }
  }

  return {
    bookmarks,
    favorites,
    fetchBookmarks,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    syncBookmarksToVault,
  };
}
