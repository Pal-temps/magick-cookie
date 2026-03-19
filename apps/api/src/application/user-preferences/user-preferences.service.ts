import type { UserPreferencesRepository } from "../../domain/user-preferences/user-preferences.repository";

export class UserPreferencesService {
  constructor(private repo: UserPreferencesRepository) {}

  async get(): Promise<object | null> {
    const row = await this.repo.find();
    if (!row) return null;
    try {
      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }

  async save(data: object): Promise<object> {
    const row = await this.repo.upsert({ data: JSON.stringify(data) });
    return JSON.parse(row.data);
  }
}
