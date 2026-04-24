import { describe, it, expect, beforeEach, mock } from "bun:test";
import { SnippetService } from "../../application/snippet/snippet.service";
import type { SnippetRepository } from "../../domain/snippet/snippet.repository";
import type { Snippet } from "../../domain/snippet/snippet.entity";

const makeSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: "s-1",
  title: "Hello World",
  content: "console.log('hello');",
  language: "typescript",
  tags: ["utils"],
  isFavorite: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("SnippetService", () => {
  let service: SnippetService;
  let mockRepo: Record<keyof SnippetRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeSnippet())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new SnippetService(
      mockRepo as unknown as SnippetRepository,
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
    const options = { tag: "utils", language: "typescript", limit: 10, offset: 0 };
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
    const input = { title: "Hello World", content: "console.log('hello');", tags: ["utils", "debug"] };
    const created = makeSnippet({ tags: ["utils", "debug"] });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated snippet when found", async () => {
    const updated = makeSnippet({ title: "Hello World v2", tags: ["utils", "refactor"] });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("s-1", { title: "Hello World v2", tags: ["utils", "refactor"] });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("s-1", { title: "Hello World v2", tags: ["utils", "refactor"] });
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
});
