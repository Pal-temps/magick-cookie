export interface UserPreferencesEntity {
  id: string;
  data: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertUserPreferencesInput {
  data: string;
}
