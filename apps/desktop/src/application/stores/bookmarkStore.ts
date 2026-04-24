import { createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../infrastructure/api/apiClient";
import { createCrudStore } from "./createCrudStore";

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
  category?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateBookmarkInput {
  name?: string;
  url?: string;
  emoji?: string | null;
  category?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

const crud = createCrudStore<Bookmark, CreateBookmarkInput, UpdateBookmarkInput>({
  endpoint: "/bookmarks",
  label: "bookmarks",
});
const [categories, setCategories] = createSignal<BookmarkCategory[]>([]);
const [filterQuery, setFilterQuery] = createSignal("");
const [filterCategory, setFilterCategory] = createSignal("all");

export function useBookmarkStore() {
  const favorites = createMemo(() => crud.items().filter((b) => b.isFavorite));

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
    await fetchCategories();
    await crud.fetchAll();
    syncBookmarksToVault();
  }

  async function createBookmark(input: CreateBookmarkInput) {
    const bookmark = await crud.create(input);
    if (bookmark) syncBookmarksToVault();
    return bookmark;
  }

  async function updateBookmark(id: string, input: UpdateBookmarkInput) {
    const bookmark = await crud.update(id, input);
    if (bookmark) syncBookmarksToVault();
    return bookmark;
  }

  async function deleteBookmark(id: string) {
    await crud.delete(id);
    syncBookmarksToVault();
  }

  async function toggleFavorite(id: string) {
    const bookmark = crud.items().find((b) => b.id === id);
    if (bookmark) {
      await updateBookmark(id, { isFavorite: !bookmark.isFavorite });
    }
  }

  /** Write a _bookmarks/bookmarks.md file in the notes vault (git-synced) */
  async function syncBookmarksToVault() {
    try {
      const all = crud.items();
      if (all.length === 0) {
        await invoke("notes_save", { path: "_bookmarks/bookmarks.md", content: "# Crookies\n\nAucun crookie.\n" });
        return;
      }

      const currentCategories = categories();
      const categoryLabels: Record<string, string> = { none: "Sans categorie" };
      for (const c of currentCategories) {
        categoryLabels[c.value] = c.label;
      }

      // Group by category
      const groupedByCategory = new Map<string, typeof all>();
      for (const b of all) {
        const key = b.category || "none";
        if (!groupedByCategory.has(key)) groupedByCategory.set(key, []);
        groupedByCategory.get(key)!.push(b);
      }

      const lines: string[] = ["# Crookies", ""];

      for (const [cat, items] of groupedByCategory) {
        lines.push(`## ${categoryLabels[cat] || cat}`, "");
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
    bookmarks: crud.items,
    favorites,
    categories,
    fetchBookmarks,
    fetchCategories,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    syncBookmarksToVault,
    createCategory,
    updateCategory,
    deleteCategory,
    filterQuery, setFilterQuery,
    filterCategory, setFilterCategory,
  };
}
