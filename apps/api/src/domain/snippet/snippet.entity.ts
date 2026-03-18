export interface Snippet {
  id: string;
  title: string;
  content: string;
  language: string;
  category: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export interface SnippetCategory {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  createdAt: Date;
}

export interface CreateSnippetCategoryInput {
  value: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateSnippetCategoryInput {
  label?: string;
  sortOrder?: number;
}
