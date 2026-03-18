import { createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../infrastructure/api/apiClient";

export interface BookmarkTag {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  name: string;
  url: string;
  emoji: string | null;
  tag: string;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkInput {
  name: string;
  url: string;
  emoji?: string | null;
  tag?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateBookmarkInput {
  name?: string;
  url?: string;
  emoji?: string | null;
  tag?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

const [bookmarks, setBookmarks] = createSignal<Bookmark[]>([]);
const [tags, setTags] = createSignal<BookmarkTag[]>([]);

export function useBookmarkStore() {
  const favorites = createMemo(() => bookmarks().filter((b) => b.isFavorite));

  async function fetchTags() {
    try {
      const data = await api.get<BookmarkTag[]>("/bookmarks/tags");
      setTags(data);
    } catch (e) {
      console.error("Failed to fetch bookmark tags:", e);
    }
  }

  async function createTag(input: { value: string; label: string }) {
    try {
      await api.post("/bookmarks/tags", input);
      await fetchTags();
    } catch (e) {
      console.error("Failed to create tag:", e);
    }
  }

  async function updateTag(id: string, input: { label?: string }) {
    try {
      await api.put(`/bookmarks/tags/${id}`, input);
      await fetchTags();
    } catch (e) {
      console.error("Failed to update tag:", e);
    }
  }

  async function deleteTag(id: string) {
    try {
      await api.delete(`/bookmarks/tags/${id}`);
      await fetchTags();
    } catch (e) {
      console.error("Failed to delete tag:", e);
    }
  }

  async function fetchBookmarks() {
    try {
      await fetchTags();
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

      const currentTags = tags();
      const tagLabels: Record<string, string> = { none: "Sans tag" };
      for (const t of currentTags) {
        tagLabels[t.value] = t.label;
      }

      const grouped = new Map<string, typeof all>();
      for (const b of all) {
        const key = b.tag || "none";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(b);
      }

      const lines: string[] = ["# Signets", ""];

      for (const [tag, items] of grouped) {
        lines.push(`## ${tagLabels[tag] || tag}`, "");
        for (const b of items) {
          const star = b.isFavorite ? " ★" : "";
          lines.push(`- ${b.emoji ? b.emoji + " " : ""}[${b.name}](${b.url})${star}`);
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
    tags,
    fetchBookmarks,
    fetchTags,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    syncBookmarksToVault,
    createTag,
    updateTag,
    deleteTag,
  };
}
