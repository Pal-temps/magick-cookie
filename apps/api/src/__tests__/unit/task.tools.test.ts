import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createTaskTools } from "../../application/agent/tools/task.tools";
import type { TaskService } from "../../application/task/task.service";
import type { FluxService } from "../../application/flux/flux.service";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("task.tools", () => {
  let taskSvc: { [K in keyof TaskService]: ReturnType<typeof mock> };
  let fluxSvc: { [K in keyof FluxService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTasks: AgentTool;
  let priority: AgentTool;
  let byStatus: AgentTool;
  let setFlux: AgentTool;
  let createTask: AgentTool;

  beforeEach(() => {
    taskSvc = {
      getAll: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
      create: mock(() => Promise.resolve({ id: "t1", title: "x" } as never)),
      update: mock(() => Promise.resolve(null)),
      getBySource: mock(() => Promise.resolve([])),
      getUnscheduled: mock(() => Promise.resolve([])),
      countUnscheduled: mock(() => Promise.resolve(0)),
      getById: mock(() => Promise.resolve(null)),
      getByExternalId: mock(() => Promise.resolve(null)),
    } as unknown as { [K in keyof TaskService]: ReturnType<typeof mock> };

    fluxSvc = {
      getAll: mock(() => Promise.resolve([])),
      getAllPaginated: mock(() => Promise.resolve({ data: [], total: 0 })),
      getByStatus: mock(() => Promise.resolve([])),
      setFlux: mock(() => Promise.resolve({} as never)),
      bulkSetFlux: mock(() => Promise.resolve()),
      resetFlux: mock(() => Promise.resolve()),
      resetAll: mock(() => Promise.resolve()),
      getCounts: mock(() => Promise.resolve({} as never)),
      getKanban: mock(() => Promise.resolve([])),
      suggestFlux: mock(() => Promise.resolve([])),
    } as unknown as { [K in keyof FluxService]: ReturnType<typeof mock> };

    tools = createTaskTools(taskSvc as unknown as TaskService, fluxSvc as unknown as FluxService);
    listTasks = tools.find((t) => t.name === "get_all_tasks")!;
    priority = tools.find((t) => t.name === "get_priority_items")!;
    byStatus = tools.find((t) => t.name === "get_flux_by_status")!;
    setFlux = tools.find((t) => t.name === "set_flux")!;
    createTask = tools.find((t) => t.name === "create_task")!;
  });

  it("registers 5 tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "create_task", "get_all_tasks", "get_flux_by_status", "get_priority_items", "set_flux",
    ]);
  });

  it("get_all_tasks caps results at 30", async () => {
    const lots = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}` }));
    taskSvc.getAll.mockReturnValue(Promise.resolve(lots as never));
    const result = (await listTasks.execute({})) as unknown[];
    expect(result).toHaveLength(30);
  });

  it("get_priority_items delegates to flux.getByStatus('priority')", async () => {
    await priority.execute({});
    expect(fluxSvc.getByStatus).toHaveBeenCalledWith("priority", undefined);
  });

  it("get_priority_items forwards entityType filter", async () => {
    await priority.execute({ entityType: "email" });
    expect(fluxSvc.getByStatus).toHaveBeenCalledWith("priority", "email");
  });

  it("get_priority_items rejects unknown entityType", async () => {
    const result = (await priority.execute({ entityType: "calendar" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(fluxSvc.getByStatus).not.toHaveBeenCalled();
  });

  it("get_flux_by_status forwards both args", async () => {
    await byStatus.execute({ status: "later", entityType: "task" });
    expect(fluxSvc.getByStatus).toHaveBeenCalledWith("later", "task");
  });

  it("get_flux_by_status rejects unknown status", async () => {
    const result = (await byStatus.execute({ status: "todo" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(fluxSvc.getByStatus).not.toHaveBeenCalled();
  });

  it("set_flux maps status -> fluxStatus on the service input", async () => {
    const result = (await setFlux.execute({ entityType: "task", entityId: "t1", status: "archived" })) as { success: boolean; status: string };
    expect(result.success).toBe(true);
    expect(result.status).toBe("archived");
    const arg = fluxSvc.setFlux.mock.calls[0][0] as { entityType: string; entityId: string; fluxStatus: string };
    expect(arg).toEqual({ entityType: "task", entityId: "t1", fluxStatus: "archived" });
  });

  it("create_task forwards title with source='manual'", async () => {
    await createTask.execute({ title: "Buy milk" });
    expect(taskSvc.create).toHaveBeenCalledWith({ title: "Buy milk", source: "manual" });
  });

  it("create_task rejects empty title", async () => {
    const result = (await createTask.execute({ title: "" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(taskSvc.create).not.toHaveBeenCalled();
  });
});
