import { createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../infrastructure/api/apiClient";

export interface Snippet {
  id: string;
  title: string;
  content: string;
  language: string;
  category: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SnippetCategory {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  createdAt: string;
}

export interface CreateSnippetInput {
  title: string;
  content: string;
  language?: string;
  category?: string;
  isFavorite?: boolean;
}

export interface UpdateSnippetInput {
  title?: string;
  content?: string;
  language?: string;
  category?: string;
  isFavorite?: boolean;
}

const [snippets, setSnippets] = createSignal<Snippet[]>([]);
const [categories, setCategories] = createSignal<SnippetCategory[]>([]);
const [selectedSnippet, setSelectedSnippet] = createSignal<Snippet | null>(null);

export function useSnippetStore() {
  const favorites = createMemo(() => snippets().filter((s) => s.isFavorite));

  async function fetchCategories() {
    try {
      const data = await api.get<SnippetCategory[]>("/snippets/categories");
      setCategories(data);
    } catch (e) {
      console.error("Failed to fetch snippet categories:", e);
    }
  }

  async function createCategory(input: { value: string; label: string }) {
    try {
      await api.post("/snippets/categories", input);
      await fetchCategories();
    } catch (e) {
      console.error("Failed to create snippet category:", e);
    }
  }

  async function updateCategory(id: string, input: { label?: string }) {
    try {
      await api.put(`/snippets/categories/${id}`, input);
      await fetchCategories();
    } catch (e) {
      console.error("Failed to update snippet category:", e);
    }
  }

  async function deleteCategory(id: string) {
    try {
      await api.delete(`/snippets/categories/${id}`);
      await fetchCategories();
    } catch (e) {
      console.error("Failed to delete snippet category:", e);
    }
  }

  async function fetchSnippets(options?: { category?: string; language?: string }) {
    try {
      await fetchCategories();
      let url = "/snippets";
      const params: string[] = [];
      if (options?.category) params.push(`category=${encodeURIComponent(options.category)}`);
      if (options?.language) params.push(`language=${encodeURIComponent(options.language)}`);
      if (params.length > 0) url += "?" + params.join("&");
      const data = await api.get<Snippet[]>(url);
      setSnippets(data);
      syncSnippetsToVault();
    } catch (e) {
      console.error("Failed to fetch snippets:", e);
    }
  }

  async function createSnippet(input: CreateSnippetInput) {
    try {
      const snippet = await api.post<Snippet>("/snippets", input);
      setSnippets((prev) => [...prev, snippet]);
      syncSnippetsToVault();
      return snippet;
    } catch (e) {
      console.error("Failed to create snippet:", e);
    }
  }

  async function updateSnippet(id: string, input: UpdateSnippetInput) {
    try {
      const snippet = await api.put<Snippet>(`/snippets/${id}`, input);
      setSnippets((prev) => prev.map((s) => (s.id === id ? snippet : s)));
      if (selectedSnippet()?.id === id) setSelectedSnippet(snippet);
      syncSnippetsToVault();
      return snippet;
    } catch (e) {
      console.error("Failed to update snippet:", e);
    }
  }

  async function deleteSnippet(id: string) {
    try {
      await api.delete(`/snippets/${id}`);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      if (selectedSnippet()?.id === id) setSelectedSnippet(null);
      syncSnippetsToVault();
    } catch (e) {
      console.error("Failed to delete snippet:", e);
    }
  }

  async function toggleFavorite(id: string) {
    const snippet = snippets().find((s) => s.id === id);
    if (snippet) {
      await updateSnippet(id, { isFavorite: !snippet.isFavorite });
    }
  }

  async function syncSnippetsToVault() {
    try {
      const all = snippets();
      if (all.length === 0) {
        await invoke("notes_save", { path: "_snippets/snippets.md", content: "# Snippets\n\nAucun snippet.\n" });
        return;
      }

      const cats = categories();
      const catLabels: Record<string, string> = { none: "Sans categorie" };
      for (const c of cats) catLabels[c.value] = c.label;

      const grouped = new Map<string, Snippet[]>();
      for (const s of all) {
        const key = s.category || "none";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s);
      }

      const lines: string[] = ["# Snippets", ""];

      for (const [cat, items] of grouped) {
        lines.push(`## ${catLabels[cat] || cat}`, "");
        for (const s of items) {
          const fav = s.isFavorite ? " ★" : "";
          lines.push(`### ${s.title}${fav}`, "");
          lines.push(`\`\`\`${s.language}`);
          lines.push(s.content);
          lines.push("```", "");
        }
      }

      await invoke("notes_save", { path: "_snippets/snippets.md", content: lines.join("\n") });
    } catch {
      // Vault not configured — skip
    }
  }

  return {
    snippets,
    categories,
    favorites,
    selectedSnippet,
    setSelectedSnippet,
    fetchSnippets,
    fetchCategories,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    toggleFavorite,
    createCategory,
    updateCategory,
    deleteCategory,
    syncSnippetsToVault,
  };
}
