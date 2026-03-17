import { eq } from "drizzle-orm";
import type { Database } from "../database/client";
import { projects } from "../database/schema";
import type { ProjectRepository } from "../../domain/project/project.repository";
import type { Project, CreateProjectInput, UpdateProjectInput } from "../../domain/project/project.entity";

export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<Project[]> {
    const rows = await this.db.select().from(projects).orderBy(projects.name);
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<Project | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, id));
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const rows = await this.db.insert(projects).values({
      name: input.name,
      color: input.color ?? "#6c5ce7",
    }).returning();
    return this.toDomain(rows[0]);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.color !== undefined) values.color = input.color;

    const rows = await this.db.update(projects).set(values).where(eq(projects.id, id)).returning();
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
    return rows.length > 0;
  }

  private toDomain(row: typeof projects.$inferSelect): Project {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
