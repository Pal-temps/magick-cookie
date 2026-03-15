import type { DogWalkRepository } from "../../domain/dog-walk/dog-walk.repository";
import type { DogWalk, CreateDogWalkInput } from "../../domain/dog-walk/dog-walk.entity";

export class DogWalkService {
  constructor(private repo: DogWalkRepository) {}

  async getActive(): Promise<DogWalk | null> {
    return this.repo.findActive();
  }

  async getAll(from?: Date, to?: Date): Promise<DogWalk[]> {
    return this.repo.findAll(from, to);
  }

  async start(input?: CreateDogWalkInput): Promise<DogWalk> {
    // Check if there's already an active walk
    const active = await this.repo.findActive();
    if (active) {
      throw new Error("A walk is already in progress");
    }
    return this.repo.create(input ?? {});
  }

  async stop(id: string): Promise<DogWalk> {
    const walk = await this.repo.findActive();
    if (!walk || walk.id !== id) {
      throw new Error("No active walk found with this id");
    }
    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - walk.startedAt.getTime()) / 1000);
    return this.repo.stop(id, { endedAt, durationSeconds });
  }

  async getTodayStats(): Promise<{ totalSeconds: number; walkCount: number }> {
    return this.repo.getTodayStats();
  }

  async getDailyStats(from: Date, to: Date) {
    return this.repo.getDailyStats(from, to);
  }
}
