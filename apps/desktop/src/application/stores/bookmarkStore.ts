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

export interface BookmarkCategory {
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
  category: string;
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
  category?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateBookmarkInput {
  name?: string;
  url?: string;
  emoji?: string | null;
  tag?: string;
  category?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

const [bookmarks, setBookmarks] = createSignal<Bookmark[]>([]);
const [tags, setTags] = createSignal<BookmarkTag[]>([]);
const [categories, setCategories] = createSignal<BookmarkCategory[]>([]);

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

  async function fetchCategories() {
    try {
      const data = await api.get<BookmarkCategory[]>("/bookmarks/categories");
      setCategories(data);
    } catch (e) {
      console.error("Failed to fetch bookmark categories:", e);
    }
  }

  async function createCategory(input: { value: string; label: string }) {
    try {
      await api.post("/bookmarks/categories", input);
      await fetchCategories();
    } catch (e) {
      console.error("Failed to create category:", e);
    }
  }

  async function updateCategory(id: string, input: { label?: string }) {
    try {
      await api.put(`/bookmarks/categories/${id}`, input);
      await fetchCategories();
    } catch (e) {
      console.error("Failed to update category:", e);
    }
  }

  async function deleteCategory(id: string) {
    try {
      await api.delete(`/bookmarks/categories/${id}`);
      await fetchCategories();
    } catch (e) {
      console.error("Failed to delete category:", e);
    }
  }

  async function fetchBookmarks() {
    try {
      await fetchTags();
      await fetchCategories();
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

      const currentCategories = categories();
      const categoryLabels: Record<string, string> = { none: "Sans categorie" };
      for (const c of currentCategories) {
        categoryLabels[c.value] = c.label;
      }

      // Group by category first, then by tag within each category
      const groupedByCategory = new Map<string, typeof all>();
      for (const b of all) {
        const key = b.category || "none";
        if (!groupedByCategory.has(key)) groupedByCategory.set(key, []);
        groupedByCategory.get(key)!.push(b);
      }

      const lines: string[] = ["# Signets", ""];

      for (const [cat, catItems] of groupedByCategory) {
        lines.push(`## ${categoryLabels[cat] || cat}`, "");

        const groupedByTag = new Map<string, typeof catItems>();
        for (const b of catItems) {
          const key = b.tag || "none";
          if (!groupedByTag.has(key)) groupedByTag.set(key, []);
          groupedByTag.get(key)!.push(b);
        }

        for (const [tag, items] of groupedByTag) {
          lines.push(`### ${tagLabels[tag] || tag}`, "");
          for (const b of items) {
            const star = b.isFavorite ? " ★" : "";
            lines.push(`- ${b.emoji ? b.emoji + " " : ""}[${b.name}](${b.url})${star}`);
          }
          lines.push("");
        }
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
    categories,
    fetchBookmarks,
    fetchTags,
    fetchCategories,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    syncBookmarksToVault,
    createTag,
    updateTag,
    deleteTag,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
