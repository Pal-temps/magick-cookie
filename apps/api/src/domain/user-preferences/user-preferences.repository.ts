import type { UserPreferencesEntity, UpsertUserPreferencesInput } from "./user-preferences.entity";

export interface UserPreferencesRepository {
  find(): Promise<UserPreferencesEntity | null>;
  upsert(input: UpsertUserPreferencesInput): Promise<UserPreferencesEntity>;
}
