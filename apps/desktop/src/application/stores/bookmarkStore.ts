import { createSignal, createMemo } from "solid-js";
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
    } catch (e) {
      console.error("Failed to fetch bookmarks:", e);
    }
  }

  async function createBookmark(input: CreateBookmarkInput) {
    try {
      const bookmark = await api.post<Bookmark>("/bookmarks", input);
      setBookmarks((prev) => [...prev, bookmark]);
      return bookmark;
    } catch (e) {
      console.error("Failed to create bookmark:", e);
    }
  }

  async function updateBookmark(id: string, input: UpdateBookmarkInput) {
    try {
      const bookmark = await api.put<Bookmark>(`/bookmarks/${id}`, input);
      setBookmarks((prev) => prev.map((b) => (b.id === id ? bookmark : b)));
      return bookmark;
    } catch (e) {
      console.error("Failed to update bookmark:", e);
    }
  }

  async function deleteBookmark(id: string) {
    try {
      await api.delete(`/bookmarks/${id}`);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
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

  return {
    bookmarks,
    favorites,
    fetchBookmarks,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
  };
}
