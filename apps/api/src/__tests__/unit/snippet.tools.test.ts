import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createSnippetTools } from "../../application/agent/tools/snippet.tools";
import type { SnippetService } from "../../application/snippet/snippet.service";
import type { Snippet } from "../../domain/snippet/snippet.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: "sn-1",
  title: "Reduce",
  content: "[].reduce(...)",
  language: "typescript",
  tags: ["fp"],
  isFavorite: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("snippet.tools", () => {
  let svc: { [K in keyof SnippetService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let createTool: AgentTool;
  let updateTool: AgentTool;
  let deleteTool: AgentTool;
  let searchTool: AgentTool;

  beforeEach(() => {
    svc = {
      getAll: mock(() => Promise.resolve([])),
      getById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeSnippet())),
      update: mock(() => Promise.resolve(makeSnippet())),
      delete: mock(() => Promise.resolve(true)),
    } as unknown as { [K in keyof SnippetService]: ReturnType<typeof mock> };

    tools = createSnippetTools(svc as unknown as SnippetService);
    listTool = tools.find((t) => t.name === "snippet_list")!;
    createTool = tools.find((t) => t.name === "snippet_create")!;
    updateTool = tools.find((t) => t.name === "snippet_update")!;
    deleteTool = tools.find((t) => t.name === "snippet_delete")!;
    searchTool = tools.find((t) => t.name === "snippet_search_by_tag")!;
  });

  it("registers the 5 P4.5 snippet tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "snippet_create",
      "snippet_delete",
      "snippet_list",
      "snippet_search_by_tag",
      "snippet_update",
    ]);
  });

  it("only snippet_delete is user-confirm", () => {
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    expect(listTool.permissionLevel).toBe("auto");
    expect(createTool.permissionLevel).toBe("auto");
    expect(updateTool.permissionLevel).toBe("auto");
    expect(searchTool.permissionLevel).toBe("auto");
  });

  describe("snippet_list", () => {
    it("forwards language filter and defaults limit to 100", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([makeSnippet()]));
      const result = (await listTool.execute({ language: "rust" })) as { count: number };
      expect(result.count).toBe(1);
      expect(svc.getAll).toHaveBeenCalledWith({ language: "rust", limit: 100 });
    });

    it("respects an explicit limit", async () => {
      await listTool.execute({ limit: 5 });
      expect(svc.getAll).toHaveBeenCalledWith({ language: undefined, limit: 5 });
    });

    it("rejects oversized limit via zod", async () => {
      const result = (await listTool.execute({ limit: 9999 })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.getAll).not.toHaveBeenCalled();
    });
  });

  describe("snippet_create", () => {
    it("forwards all fields", async () => {
      svc.create.mockReturnValue(Promise.resolve(makeSnippet({ title: "X" })));
      await createTool.execute({
        title: "X",
        content: "console.log()",
        language: "typescript",
        tags: ["log", "debug"],
        isFavorite: true,
      });
      const arg = svc.create.mock.calls[0][0] as { title: string; tags: string[]; isFavorite: boolean };
      expect(arg.title).toBe("X");
      expect(arg.tags).toEqual(["log", "debug"]);
      expect(arg.isFavorite).toBe(true);
    });

    it("rejects empty content via zod", async () => {
      const result = (await createTool.execute({ title: "X", content: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("rejects more than 20 tags via zod", async () => {
      const tags = Array.from({ length: 21 }, (_, i) => `t${i}`);
      const result = (await createTool.execute({ title: "X", content: "x", tags })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });

    it("wraps a service throw as { error }", async () => {
      svc.create.mockReturnValue(Promise.reject(new Error("Constraint violation")));
      const result = (await createTool.execute({ title: "X", content: "x" })) as { error?: string };
      expect(result.error).toBe("Constraint violation");
    });
  });

  describe("snippet_update", () => {
    it("only forwards fields that were provided", async () => {
      svc.update.mockReturnValue(Promise.resolve(makeSnippet({ title: "Renamed" })));
      await updateTool.execute({ id: "sn-1", title: "Renamed" });
      const [id, input] = svc.update.mock.calls[0];
      expect(id).toBe("sn-1");
      expect(Object.keys(input as object)).toEqual(["title"]);
    });

    it("returns a not-found error when service returns null", async () => {
      svc.update.mockReturnValue(Promise.resolve(null));
      const result = (await updateTool.execute({ id: "ghost", title: "X" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });

    it("supports replacing tags wholesale", async () => {
      await updateTool.execute({ id: "sn-1", tags: ["new", "set"] });
      const [, input] = svc.update.mock.calls[0];
      expect((input as { tags: string[] }).tags).toEqual(["new", "set"]);
    });
  });

  describe("snippet_delete", () => {
    it("delegates and returns the id", async () => {
      svc.delete.mockReturnValue(Promise.resolve(true));
      const result = (await deleteTool.execute({ id: "sn-1" })) as { deleted: boolean; id: string };
      expect(result.deleted).toBe(true);
      expect(result.id).toBe("sn-1");
    });

    it("returns a not-found error when service returns false", async () => {
      svc.delete.mockReturnValue(Promise.resolve(false));
      const result = (await deleteTool.execute({ id: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("snippet_search_by_tag", () => {
    it("forwards tag and defaults limit to 100", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([makeSnippet({ tags: ["fp"] })]));
      const result = (await searchTool.execute({ tag: "fp" })) as { tag: string; count: number };
      expect(result.tag).toBe("fp");
      expect(result.count).toBe(1);
      expect(svc.getAll).toHaveBeenCalledWith({ tag: "fp", limit: 100 });
    });

    it("rejects empty tag via zod", async () => {
      const result = (await searchTool.execute({ tag: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.getAll).not.toHaveBeenCalled();
    });
  });
});
