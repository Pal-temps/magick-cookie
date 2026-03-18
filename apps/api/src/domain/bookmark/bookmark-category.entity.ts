export interface BookmarkCategory {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  createdAt: Date;
}

export interface CreateBookmarkCategoryInput {
  value: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateBookmarkCategoryInput {
  label?: string;
  sortOrder?: number;
}
