export interface Bookmark {
  id: string;
  name: string;
  url: string;
  emoji: string | null;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
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
