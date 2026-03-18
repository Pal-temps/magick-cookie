import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { routines } from "../database/schema";
import type { RoutineRepository } from "../../domain/routine/routine.repository";
import type { Routine, RoutineStep, CreateRoutineInput, UpdateRoutineInput } from "../../domain/routine/routine.entity";

export class DrizzleRoutineRepository implements RoutineRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Routine[]> {
    const rows = await this.db.select().from(routines).orderBy(routines.triggerTime);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Routine | null> {
    const rows = await this.db.select().from(routines).where(eq(routines.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findEnabled(): Promise<Routine[]> {
    const rows = await this.db.select().from(routines).where(eq(routines.enabled, true)).orderBy(routines.triggerTime);
    return rows.map(this.toDomain);
  }

  async create(input: CreateRoutineInput): Promise<Routine> {
    const rows = await this.db.insert(routines).values({
      name: input.name,
      triggerTime: input.triggerTime,
      triggerDays: input.triggerDays ? input.triggerDays.join(",") : "1,2,3,4,5",
      steps: input.steps ? JSON.stringify(input.steps) : "[]",
      enabled: input.enabled ?? true,
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateRoutineInput): Promise<Routine | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.triggerTime !== undefined) values.triggerTime = input.triggerTime;
    if (input.triggerDays !== undefined) values.triggerDays = input.triggerDays.join(",");
    if (input.steps !== undefined) values.steps = JSON.stringify(input.steps);
    if (input.enabled !== undefined) values.enabled = input.enabled;

    const rows = await this.db.update(routines).set(values).where(eq(routines.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(routines).where(eq(routines.id, id)).returning({ id: routines.id });
    return rows.length > 0;
  }

  async markRun(id: string): Promise<void> {
    await this.db.update(routines).set({ lastRunAt: new Date() }).where(eq(routines.id, id));
  }

  private toDomain(row: typeof routines.$inferSelect): Routine {
    return {
      id: row.id,
      name: row.name,
      triggerTime: row.triggerTime,
      triggerDays: row.triggerDays.split(",").map(Number),
      steps: JSON.parse(row.steps) as RoutineStep[],
      enabled: row.enabled,
      lastRunAt: row.lastRunAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
