export interface Snippet {
  id: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
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
