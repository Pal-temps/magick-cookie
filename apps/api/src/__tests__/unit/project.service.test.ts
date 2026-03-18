import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ProjectService } from "../../application/project/project.service";
import type { ProjectRepository } from "../../domain/project/project.repository";
import type { Project } from "../../domain/project/project.entity";

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "p-1",
  name: "My Project",
  color: "#FF0000",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("ProjectService", () => {
  let service: ProjectService;
  let mockRepo: Record<keyof ProjectRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeProject())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new ProjectService(mockRepo as unknown as ProjectRepository);
  });

  // --- getAll ---
  it("getAll returns all projects", async () => {
    const projects = [makeProject(), makeProject({ id: "p-2", name: "Second" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(projects));

    const result = await service.getAll();

    expect(result).toEqual(projects);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when no projects", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById returns project when found", async () => {
    const project = makeProject();
    mockRepo.findById.mockReturnValue(Promise.resolve(project));

    const result = await service.getById("p-1");

    expect(result).toEqual(project);
    expect(mockRepo.findById).toHaveBeenCalledWith("p-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- create ---
  it("create delegates to repo and returns project", async () => {
    const input = { name: "New Project", color: "#00FF00" };
    const created = makeProject({ name: "New Project", color: "#00FF00" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated project when found", async () => {
    const updated = makeProject({ name: "Renamed" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("p-1", { name: "Renamed" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("p-1", { name: "Renamed" });
  });

  it("update returns null when project not found", async () => {
    const result = await service.update("missing", { name: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when project deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("p-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("p-1");
  });

  it("delete returns false when project not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });
});
