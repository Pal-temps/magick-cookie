import { describe, it, expect, beforeEach, mock } from "bun:test";
import { SnippetService } from "../../application/snippet/snippet.service";
import type { SnippetRepository } from "../../domain/snippet/snippet.repository";
import type { SnippetCategoryRepository } from "../../domain/snippet/snippet-category.repository";
import type { Snippet, SnippetCategory } from "../../domain/snippet/snippet.entity";

const makeSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: "s-1",
  title: "Hello World",
  content: "console.log('hello');",
  language: "typescript",
  category: "utils",
  isFavorite: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeCategory = (overrides: Partial<SnippetCategory> = {}): SnippetCategory => ({
  id: "sc-1",
  value: "utils",
  label: "Utilities",
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

describe("SnippetService", () => {
  let service: SnippetService;
  let mockRepo: Record<keyof SnippetRepository, ReturnType<typeof mock>>;
  let mockCategoryRepo: Record<keyof SnippetCategoryRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeSnippet())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    mockCategoryRepo = {
      findAll: mock(() => Promise.resolve([])),
      findByValue: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeCategory())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new SnippetService(
      mockRepo as unknown as SnippetRepository,
      mockCategoryRepo as unknown as SnippetCategoryRepository,
    );
  });

  // --- getAll ---
  it("getAll returns all snippets", async () => {
    const snippets = [makeSnippet(), makeSnippet({ id: "s-2", title: "Fetch" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(snippets));

    const result = await service.getAll();

    expect(result).toEqual(snippets);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when no snippets", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  it("getAll passes options to repo", async () => {
    const options = { category: "utils", language: "typescript", limit: 10, offset: 0 };
    await service.getAll(options);
    expect(mockRepo.findAll).toHaveBeenCalledWith(options);
  });

  // --- getById ---
  it("getById returns snippet when found", async () => {
    const snippet = makeSnippet();
    mockRepo.findById.mockReturnValue(Promise.resolve(snippet));

    const result = await service.getById("s-1");

    expect(result).toEqual(snippet);
    expect(mockRepo.findById).toHaveBeenCalledWith("s-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- create ---
  it("create delegates to repo and returns snippet", async () => {
    const input = { title: "Hello World", content: "console.log('hello');" };
    const created = makeSnippet();
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated snippet when found", async () => {
    const updated = makeSnippet({ title: "Hello World v2" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("s-1", { title: "Hello World v2" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("s-1", { title: "Hello World v2" });
  });

  it("update returns null when snippet not found", async () => {
    const result = await service.update("missing", { title: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when snippet deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("s-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("s-1");
  });

  it("delete returns false when snippet not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });

  // --- getAllCategories ---
  it("getAllCategories returns all categories", async () => {
    const cats = [makeCategory(), makeCategory({ id: "sc-2", value: "hooks", label: "Hooks" })];
    mockCategoryRepo.findAll.mockReturnValue(Promise.resolve(cats));

    const result = await service.getAllCategories();

    expect(result).toEqual(cats);
    expect(mockCategoryRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAllCategories returns empty array when no categories", async () => {
    const result = await service.getAllCategories();
    expect(result).toEqual([]);
  });

  // --- createCategory ---
  it("createCategory delegates to category repo and returns category", async () => {
    const input = { value: "utils", label: "Utilities" };
    const created = makeCategory();
    mockCategoryRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.createCategory(input);

    expect(result).toEqual(created);
    expect(mockCategoryRepo.create).toHaveBeenCalledWith(input);
  });

  // --- updateCategory ---
  it("updateCategory returns updated category when found", async () => {
    const updated = makeCategory({ label: "Utility Functions" });
    mockCategoryRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.updateCategory("sc-1", { label: "Utility Functions" });

    expect(result).toEqual(updated);
    expect(mockCategoryRepo.update).toHaveBeenCalledWith("sc-1", { label: "Utility Functions" });
  });

  it("updateCategory returns null when category not found", async () => {
    const result = await service.updateCategory("missing", { label: "Nope" });
    expect(result).toBeNull();
  });

  // --- deleteCategory ---
  it("deleteCategory returns true when category deleted", async () => {
    mockCategoryRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.deleteCategory("sc-1");

    expect(result).toBe(true);
    expect(mockCategoryRepo.delete).toHaveBeenCalledWith("sc-1");
  });

  it("deleteCategory returns false when category not found", async () => {
    const result = await service.deleteCategory("missing");
    expect(result).toBe(false);
  });
});
