export interface BookmarkTag {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  createdAt: Date;
}

export interface CreateBookmarkTagInput {
  value: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateBookmarkTagInput {
  label?: string;
  sortOrder?: number;
}
