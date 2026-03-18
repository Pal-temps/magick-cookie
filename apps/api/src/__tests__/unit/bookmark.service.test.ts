import { describe, it, expect, beforeEach, mock } from "bun:test";
import { BookmarkService } from "../../application/bookmark/bookmark.service";
import type { BookmarkRepository } from "../../domain/bookmark/bookmark.repository";
import type { Bookmark } from "../../domain/bookmark/bookmark.entity";

const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: "b-1",
  name: "GitHub",
  url: "https://github.com",
  emoji: null,
  tag: "none",
  isFavorite: false,
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("BookmarkService", () => {
  let service: BookmarkService;
  let mockRepo: Record<keyof BookmarkRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeBookmark())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new BookmarkService(mockRepo as unknown as BookmarkRepository);
  });

  // --- getAll ---
  it("getAll returns all bookmarks", async () => {
    const bookmarks = [makeBookmark(), makeBookmark({ id: "b-2", name: "GitLab" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(bookmarks));

    const result = await service.getAll();

    expect(result).toEqual(bookmarks);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when no bookmarks", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById returns bookmark when found", async () => {
    const bookmark = makeBookmark();
    mockRepo.findById.mockReturnValue(Promise.resolve(bookmark));

    const result = await service.getById("b-1");

    expect(result).toEqual(bookmark);
    expect(mockRepo.findById).toHaveBeenCalledWith("b-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- create ---
  it("create delegates to repo and returns bookmark", async () => {
    const input = { name: "GitHub", url: "https://github.com" };
    const created = makeBookmark();
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated bookmark when found", async () => {
    const updated = makeBookmark({ name: "GitHub Enterprise" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("b-1", { name: "GitHub Enterprise" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("b-1", { name: "GitHub Enterprise" });
  });

  it("update returns null when bookmark not found", async () => {
    const result = await service.update("missing", { name: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when bookmark deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("b-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("b-1");
  });

  it("delete returns false when bookmark not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });
});
