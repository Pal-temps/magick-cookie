export type BookmarkTag = "none" | "todo" | "toread" | "tocheck" | "towatch" | "reference" | "inspiration";

export const BOOKMARK_TAGS: { value: BookmarkTag; label: string }[] = [
  { value: "none", label: "Aucun" },
  { value: "todo", label: "A faire" },
  { value: "toread", label: "A lire" },
  { value: "tocheck", label: "A verifier" },
  { value: "towatch", label: "A regarder" },
  { value: "reference", label: "Reference" },
  { value: "inspiration", label: "Inspiration" },
];

export interface Bookmark {
  id: string;
  name: string;
  url: string;
  emoji: string | null;
  tag: BookmarkTag;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookmarkInput {
  name: string;
  url: string;
  emoji?: string | null;
  tag?: BookmarkTag;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateBookmarkInput {
  name?: string;
  url?: string;
  emoji?: string | null;
  tag?: BookmarkTag;
  isFavorite?: boolean;
  sortOrder?: number;
}
