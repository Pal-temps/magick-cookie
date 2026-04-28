import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createClickUpTools } from "../../application/agent/tools/clickup.tools";
import type { ProviderService } from "../../application/provider/provider.service";
import type { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("clickup.tools", () => {
  let client: { [K in keyof ClickUpApiClient]: ReturnType<typeof mock> };
  let provider: { getClickUpClient: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let createTask: AgentTool;
  let assign: AgentTool;
  let changeStatus: AgentTool;
  let addComment: AgentTool;

  beforeEach(() => {
    client = {
      createTask: mock(() => Promise.resolve({ id: "tk-1", url: "https://app.clickup.com/t/tk-1" })),
      assignTask: mock(() => Promise.resolve()),
      changeTaskStatus: mock(() => Promise.resolve()),
      addTaskComment: mock(() => Promise.resolve({ id: "cm-1" })),
      fetchAllTasks: mock(() => Promise.resolve([])),
      fetchTaskDetail: mock(() => Promise.resolve({ textContent: null, markdownDescription: null })),
      fetchTaskComments: mock(() => Promise.resolve([])),
    } as unknown as { [K in keyof ClickUpApiClient]: ReturnType<typeof mock> };

    provider = { getClickUpClient: mock(() => Promise.resolve(client)) };

    tools = createClickUpTools(provider as unknown as ProviderService);
    createTask = tools.find((t) => t.name === "clickup_create_task")!;
    assign = tools.find((t) => t.name === "clickup_assign")!;
    changeStatus = tools.find((t) => t.name === "clickup_change_status")!;
    addComment = tools.find((t) => t.name === "clickup_add_comment")!;
  });

  it("registers the 4 ClickUp tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "clickup_add_comment",
      "clickup_assign",
      "clickup_change_status",
      "clickup_create_task",
    ]);
  });

  it("all 4 tools are auto (no destructive paths)", () => {
    for (const t of tools) {
      expect(t.permissionLevel).toBe("auto");
    }
  });

  it("returns the standard 'not configured' error when provider has no client", async () => {
    provider.getClickUpClient.mockReturnValue(Promise.resolve(null));
    const result = (await createTask.execute({ listId: "L1", name: "X" })) as { error?: string; provider?: string };
    expect(result.error).toBe("Provider not configured");
    expect(result.provider).toBe("clickup");
  });

  describe("clickup_create_task", () => {
    it("forwards full payload and converts dueDate to a Date", async () => {
      await createTask.execute({
        listId: "L1",
        name: "Bug",
        description: "found",
        assigneeIds: [42],
        priority: 2,
        dueDate: "2026-05-15",
      });
      const [listId, input] = client.createTask.mock.calls[0];
      expect(listId).toBe("L1");
      const inputObj = input as { name: string; assigneeIds: number[]; priority: number; dueDate: Date };
      expect(inputObj.name).toBe("Bug");
      expect(inputObj.assigneeIds).toEqual([42]);
      expect(inputObj.priority).toBe(2);
      expect(inputObj.dueDate).toBeInstanceOf(Date);
    });

    it("rejects priority outside 1-4 via zod", async () => {
      const result = (await createTask.execute({ listId: "L1", name: "X", priority: 5 })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });

    it("rejects malformed dueDate via zod", async () => {
      const result = (await createTask.execute({ listId: "L1", name: "X", dueDate: "15/05/2026" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("clickup_assign", () => {
    it("forwards both add and remove arrays", async () => {
      await assign.execute({ taskId: "tk-1", add: [1, 2], remove: [3] });
      expect(client.assignTask).toHaveBeenCalledWith("tk-1", [1, 2], [3]);
    });

    it("works with only add", async () => {
      await assign.execute({ taskId: "tk-1", add: [1] });
      expect(client.assignTask).toHaveBeenCalledWith("tk-1", [1], []);
    });

    it("returns an error when both add and remove are empty/missing", async () => {
      const result = (await assign.execute({ taskId: "tk-1" })) as { error?: string };
      expect(result.error).toContain("add");
      expect(client.assignTask).not.toHaveBeenCalled();
    });
  });

  describe("clickup_change_status", () => {
    it("delegates to changeTaskStatus", async () => {
      const result = (await changeStatus.execute({ taskId: "tk-1", status: "in progress" })) as { updated: boolean; status: string };
      expect(result.updated).toBe(true);
      expect(result.status).toBe("in progress");
      expect(client.changeTaskStatus).toHaveBeenCalledWith("tk-1", "in progress");
    });

    it("rejects empty status via zod", async () => {
      const result = (await changeStatus.execute({ taskId: "tk-1", status: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("clickup_add_comment", () => {
    it("delegates with notifyAll defaulting to false", async () => {
      await addComment.execute({ taskId: "tk-1", body: "lgtm" });
      expect(client.addTaskComment).toHaveBeenCalledWith("tk-1", "lgtm", false);
    });

    it("forwards notifyAll=true", async () => {
      await addComment.execute({ taskId: "tk-1", body: "heads up", notifyAll: true });
      expect(client.addTaskComment).toHaveBeenCalledWith("tk-1", "heads up", true);
    });

    it("returns the comment id", async () => {
      client.addTaskComment.mockReturnValue(Promise.resolve({ id: "cm-99" }));
      const result = (await addComment.execute({ taskId: "tk-1", body: "x" })) as { commentId: string };
      expect(result.commentId).toBe("cm-99");
    });
  });
});
