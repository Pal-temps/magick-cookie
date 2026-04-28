import type { UserPreferencesRepository } from "../../domain/user-preferences/user-preferences.repository";

interface PrefsData {
  dailyLlmBudget?: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class LlmBudgetService {
  private dayKey = todayKey();
  private used = 0;

  constructor(private prefsRepo: UserPreferencesRepository) {}

  private resetIfNewDay(): void {
    const today = todayKey();
    if (this.dayKey !== today) {
      this.dayKey = today;
      this.used = 0;
    }
  }

  async getLimit(): Promise<number | null> {
    const row = await this.prefsRepo.find();
    if (!row) return null;
    try {
      const data = JSON.parse(row.data) as PrefsData;
      return typeof data.dailyLlmBudget === "number" && data.dailyLlmBudget > 0
        ? data.dailyLlmBudget
        : null;
    } catch {
      return null;
    }
  }

  /** Throws if the daily budget is configured and exhausted. */
  async check(): Promise<void> {
    this.resetIfNewDay();
    const limit = await this.getLimit();
    if (limit !== null && this.used >= limit) {
      throw new Error(`Budget LLM journalier atteint (${this.used}/${limit} appels). Réessaie demain ou augmente la limite dans les Paramètres.`);
    }
  }

  increment(): void {
    this.resetIfNewDay();
    this.used += 1;
  }

  async getUsage(): Promise<{ used: number; limit: number | null; dayKey: string; resetAt: string }> {
    this.resetIfNewDay();
    const limit = await this.getLimit();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return { used: this.used, limit, dayKey: this.dayKey, resetAt: tomorrow.toISOString() };
  }
}
