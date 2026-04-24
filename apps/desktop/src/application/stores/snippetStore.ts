import { createSignal, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../infrastructure/api/apiClient";
import { createCrudStore } from "./createCrudStore";

export interface Snippet {
  id: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSnippetInput {
  title: string;
  content: string;
  language?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface UpdateSnippetInput {
  title?: string;
  content?: string;
  language?: string;
  tags?: string[];
  isFavorite?: boolean;
}

const crud = createCrudStore<Snippet, CreateSnippetInput, UpdateSnippetInput>({
  endpoint: "/snippets",
  label: "snippets",
});
const [selectedSnippet, setSelectedSnippet] = createSignal<Snippet | null>(null);
const [filterQuery, setFilterQuery] = createSignal("");
const [filterLanguage, setFilterLanguage] = createSignal("all");
const [filterTag, setFilterTag] = createSignal("all");
const [filterFavorites, setFilterFavorites] = createSignal(false);

export function useSnippetStore() {
  const favorites = createMemo(() => crud.items().filter((s) => s.isFavorite));

  const allTags = createMemo(() => {
    const map: Record<string, number> = {};
    for (const s of crud.items()) {
      for (const tag of s.tags) {
        map[tag] = (map[tag] || 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  });

  async function fetchSnippets(options?: { tag?: string; language?: string }) {
    try {
      let url = "/snippets";
      const params: string[] = [];
      if (options?.tag) params.push(`tag=${encodeURIComponent(options.tag)}`);
      if (options?.language) params.push(`language=${encodeURIComponent(options.language)}`);
      if (params.length > 0) url += "?" + params.join("&");
      const data = await api.get<Snippet[]>(url);
      crud.setItems(() => data);
      syncSnippetsToVault();
    } catch (e) {
      console.error("Failed to fetch snippets:", e);
    }
  }

  async function createSnippet(input: CreateSnippetInput) {
    const snippet = await crud.create(input);
    if (snippet) syncSnippetsToVault();
    return snippet;
  }

  async function updateSnippet(id: string, input: UpdateSnippetInput) {
    const snippet = await crud.update(id, input);
    if (snippet) {
      if (selectedSnippet()?.id === id) setSelectedSnippet(snippet);
      syncSnippetsToVault();
    }
    return snippet;
  }

  async function deleteSnippet(id: string) {
    await crud.delete(id);
    if (selectedSnippet()?.id === id) setSelectedSnippet(null);
    syncSnippetsToVault();
  }

  async function toggleFavorite(id: string) {
    const snippet = crud.items().find((s) => s.id === id);
    if (snippet) {
      await updateSnippet(id, { isFavorite: !snippet.isFavorite });
    }
  }

  async function syncSnippetsToVault() {
    try {
      const all = crud.items();
      if (all.length === 0) {
        await invoke("notes_save", { path: "_snippets/snippets.md", content: "# Snippets\n\nAucun snippet.\n" });
        return;
      }

      const grouped = new Map<string, Snippet[]>();
      for (const s of all) {
        if (s.tags.length === 0) {
          const key = "sans-tag";
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(s);
        } else {
          for (const tag of s.tags) {
            if (!grouped.has(tag)) grouped.set(tag, []);
            grouped.get(tag)!.push(s);
          }
        }
      }

      const lines: string[] = ["# Snippets", ""];

      for (const [tag, items] of grouped) {
        lines.push(`## ${tag === "sans-tag" ? "Sans tag" : tag}`, "");
        const seen = new Set<string>();
        for (const s of items) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
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
    snippets: crud.items,
    favorites,
    allTags,
    selectedSnippet,
    setSelectedSnippet,
    fetchSnippets,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    toggleFavorite,
    syncSnippetsToVault,
    filterQuery, setFilterQuery,
    filterLanguage, setFilterLanguage,
    filterTag, setFilterTag,
    filterFavorites, setFilterFavorites,
  };
}
