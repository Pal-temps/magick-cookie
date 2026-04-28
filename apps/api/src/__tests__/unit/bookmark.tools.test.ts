import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createBookmarkTools } from "../../application/agent/tools/bookmark.tools";
import type { BookmarkService } from "../../application/bookmark/bookmark.service";
import type { Bookmark } from "../../domain/bookmark/bookmark.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: "b-1",
  name: "Hacker News",
  url: "https://news.ycombinator.com",
  emoji: null,
  category: "Tech",
  isFavorite: false,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("bookmark.tools", () => {
  let svc: { [K in keyof BookmarkService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let createTool: AgentTool;
  let updateTool: AgentTool;
  let deleteTool: AgentTool;
  let categorizeTool: AgentTool;

  beforeEach(() => {
    svc = {
      getAll: mock(() => Promise.resolve([])),
      getById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeBookmark())),
      update: mock(() => Promise.resolve(makeBookmark())),
      delete: mock(() => Promise.resolve(true)),
      getAllCategories: mock(() => Promise.resolve([])),
      createCategory: mock(() => Promise.resolve({} as never)),
      updateCategory: mock(() => Promise.resolve(null)),
      deleteCategory: mock(() => Promise.resolve(true)),
    } as unknown as { [K in keyof BookmarkService]: ReturnType<typeof mock> };

    tools = createBookmarkTools(svc as unknown as BookmarkService);
    listTool = tools.find((t) => t.name === "bookmark_list")!;
    createTool = tools.find((t) => t.name === "bookmark_create")!;
    updateTool = tools.find((t) => t.name === "bookmark_update")!;
    deleteTool = tools.find((t) => t.name === "bookmark_delete")!;
    categorizeTool = tools.find((t) => t.name === "bookmark_categorize")!;
  });

  it("registers the 5 P4.4 bookmark tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "bookmark_categorize",
      "bookmark_create",
      "bookmark_delete",
      "bookmark_list",
      "bookmark_update",
    ]);
  });

  it("only bookmark_delete is user-confirm", () => {
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    expect(listTool.permissionLevel).toBe("auto");
    expect(createTool.permissionLevel).toBe("auto");
    expect(updateTool.permissionLevel).toBe("auto");
    expect(categorizeTool.permissionLevel).toBe("auto");
  });

  describe("bookmark_list", () => {
    it("wraps the result with a count", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([makeBookmark(), makeBookmark({ id: "b-2" })]));
      const result = (await listTool.execute({})) as { count: number; bookmarks: Bookmark[] };
      expect(result.count).toBe(2);
      expect(result.bookmarks).toHaveLength(2);
    });
  });

  describe("bookmark_create", () => {
    it("forwards all fields and defaults emoji to null", async () => {
      svc.create.mockReturnValue(Promise.resolve(makeBookmark({ name: "X" })));
      await createTool.execute({ name: "X", url: "https://x.com", category: "Tech", isFavorite: true });
      const arg = svc.create.mock.calls[0][0] as { name: string; url: string; emoji: string | null; category: string; isFavorite: boolean };
      expect(arg.name).toBe("X");
      expect(arg.url).toBe("https://x.com");
      expect(arg.emoji).toBeNull();
      expect(arg.category).toBe("Tech");
      expect(arg.isFavorite).toBe(true);
    });

    it("forwards an explicit emoji", async () => {
      await createTool.execute({ name: "X", url: "https://x.com", emoji: "🔥" });
      const arg = svc.create.mock.calls[0][0] as { emoji: string | null };
      expect(arg.emoji).toBe("🔥");
    });

    it("rejects a non-http URL via zod", async () => {
      const result = (await createTool.execute({ name: "X", url: "ftp://x" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("rejects empty name via zod", async () => {
      const result = (await createTool.execute({ name: "", url: "https://x" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("bookmark_update", () => {
    it("only forwards fields that were provided", async () => {
      svc.update.mockReturnValue(Promise.resolve(makeBookmark({ name: "Renamed" })));
      await updateTool.execute({ id: "b-1", name: "Renamed" });
      const [id, input] = svc.update.mock.calls[0];
      expect(id).toBe("b-1");
      expect(Object.keys(input as object)).toEqual(["name"]);
    });

    it("supports nullable emoji (set to null)", async () => {
      await updateTool.execute({ id: "b-1", emoji: null });
      const [, input] = svc.update.mock.calls[0];
      expect((input as { emoji: string | null }).emoji).toBeNull();
    });

    it("returns a not-found error when service returns null", async () => {
      svc.update.mockReturnValue(Promise.resolve(null));
      const result = (await updateTool.execute({ id: "ghost", name: "X" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });

    it("rejects an invalid URL via zod", async () => {
      const result = (await updateTool.execute({ id: "b-1", url: "not-a-url" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("bookmark_delete", () => {
    it("delegates and returns the id", async () => {
      svc.delete.mockReturnValue(Promise.resolve(true));
      const result = (await deleteTool.execute({ id: "b-1" })) as { deleted: boolean; id: string };
      expect(result.deleted).toBe(true);
      expect(result.id).toBe("b-1");
    });

    it("returns a not-found error when service returns false", async () => {
      svc.delete.mockReturnValue(Promise.resolve(false));
      const result = (await deleteTool.execute({ id: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("bookmark_categorize", () => {
    it("calls update with only the category", async () => {
      svc.update.mockReturnValue(Promise.resolve(makeBookmark({ category: "Perso" })));
      const result = (await categorizeTool.execute({ id: "b-1", category: "Perso" })) as { categorized: boolean; category: string };
      expect(result.categorized).toBe(true);
      expect(result.category).toBe("Perso");
      const [id, input] = svc.update.mock.calls[0];
      expect(id).toBe("b-1");
      expect(input).toEqual({ category: "Perso" });
    });

    it("returns a not-found error when service returns null", async () => {
      svc.update.mockReturnValue(Promise.resolve(null));
      const result = (await categorizeTool.execute({ id: "ghost", category: "Tech" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });

    it("rejects empty category via zod", async () => {
      const result = (await categorizeTool.execute({ id: "b-1", category: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });
});
