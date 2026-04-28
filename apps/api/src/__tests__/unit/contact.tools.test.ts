import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createContactTools } from "../../application/agent/tools/contact.tools";
import type { ContactService } from "../../application/contact/contact.service";
import type { Contact } from "../../domain/contact/contact.entity";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: "c-1",
  name: "Alice Martin",
  email: "alice@example.com",
  phone: null,
  birthDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("contact.tools", () => {
  let svc: { [K in keyof ContactService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let createTool: AgentTool;
  let updateTool: AgentTool;
  let deleteTool: AgentTool;
  let findTool: AgentTool;

  beforeEach(() => {
    svc = {
      getAll: mock(() => Promise.resolve([])),
      getById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeContact())),
      update: mock(() => Promise.resolve(makeContact())),
      delete: mock(() => Promise.resolve(true)),
    } as unknown as { [K in keyof ContactService]: ReturnType<typeof mock> };

    tools = createContactTools(svc as unknown as ContactService);
    listTool = tools.find((t) => t.name === "contact_list")!;
    createTool = tools.find((t) => t.name === "contact_create")!;
    updateTool = tools.find((t) => t.name === "contact_update")!;
    deleteTool = tools.find((t) => t.name === "contact_delete")!;
    findTool = tools.find((t) => t.name === "contact_find_by_email")!;
  });

  it("registers the 5 P4.6 contact tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "contact_create",
      "contact_delete",
      "contact_find_by_email",
      "contact_list",
      "contact_update",
    ]);
  });

  it("only contact_delete is user-confirm", () => {
    expect(deleteTool.permissionLevel).toBe("user-confirm");
    expect(listTool.permissionLevel).toBe("auto");
    expect(createTool.permissionLevel).toBe("auto");
    expect(updateTool.permissionLevel).toBe("auto");
    expect(findTool.permissionLevel).toBe("auto");
  });

  describe("contact_list", () => {
    it("wraps the result with a count", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([makeContact(), makeContact({ id: "c-2" })]));
      const result = (await listTool.execute({})) as { count: number };
      expect(result.count).toBe(2);
    });
  });

  describe("contact_create", () => {
    it("converts birthDate string to Date and defaults nullable fields to null", async () => {
      await createTool.execute({ name: "Bob", birthDate: "1990-05-15" });
      const arg = svc.create.mock.calls[0][0] as { name: string; email: string | null; phone: string | null; birthDate: Date | null };
      expect(arg.name).toBe("Bob");
      expect(arg.email).toBeNull();
      expect(arg.phone).toBeNull();
      expect(arg.birthDate).toBeInstanceOf(Date);
      expect((arg.birthDate as Date).toISOString().slice(0, 10)).toBe("1990-05-15");
    });

    it("rejects malformed email via zod", async () => {
      const result = (await createTool.execute({ name: "Bob", email: "not-an-email" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("rejects malformed birthDate via zod", async () => {
      const result = (await createTool.execute({ name: "Bob", birthDate: "15/05/1990" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("contact_update", () => {
    it("only forwards fields that were provided", async () => {
      svc.update.mockReturnValue(Promise.resolve(makeContact({ name: "Renamed" })));
      await updateTool.execute({ id: "c-1", name: "Renamed" });
      const [id, input] = svc.update.mock.calls[0];
      expect(id).toBe("c-1");
      expect(Object.keys(input as object)).toEqual(["name"]);
    });

    it("treats birthDate=null as 'clear the field'", async () => {
      await updateTool.execute({ id: "c-1", birthDate: null });
      const [, input] = svc.update.mock.calls[0];
      expect((input as { birthDate: Date | null }).birthDate).toBeNull();
    });

    it("converts birthDate string to Date on update", async () => {
      await updateTool.execute({ id: "c-1", birthDate: "2026-01-15" });
      const [, input] = svc.update.mock.calls[0];
      expect((input as { birthDate: Date }).birthDate).toBeInstanceOf(Date);
    });

    it("returns a not-found error when service returns null", async () => {
      svc.update.mockReturnValue(Promise.resolve(null));
      const result = (await updateTool.execute({ id: "ghost", name: "X" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("contact_delete", () => {
    it("delegates and returns the id", async () => {
      const result = (await deleteTool.execute({ id: "c-1" })) as { deleted: boolean; id: string };
      expect(result.deleted).toBe(true);
      expect(result.id).toBe("c-1");
    });

    it("returns a not-found error when service returns false", async () => {
      svc.delete.mockReturnValue(Promise.resolve(false));
      const result = (await deleteTool.execute({ id: "ghost" })) as { error?: string };
      expect(result.error).toContain("introuvable");
    });
  });

  describe("contact_find_by_email", () => {
    it("matches case-insensitively and returns the contact", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([
        makeContact({ id: "c-1", email: "Alice@Example.com" }),
        makeContact({ id: "c-2", email: "bob@example.com" }),
      ]));
      const result = (await findTool.execute({ email: "ALICE@example.COM" })) as { found: boolean; contact: { id: string } };
      expect(result.found).toBe(true);
      expect(result.contact.id).toBe("c-1");
    });

    it("returns found=false when no match", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([makeContact({ email: "alice@example.com" })]));
      const result = (await findTool.execute({ email: "ghost@nowhere.com" })) as { found: boolean; email: string };
      expect(result.found).toBe(false);
      expect(result.email).toBe("ghost@nowhere.com");
    });

    it("ignores contacts with null email (no false positive on empty match)", async () => {
      svc.getAll.mockReturnValue(Promise.resolve([
        makeContact({ id: "c-1", email: null }),
        makeContact({ id: "c-2", email: "bob@example.com" }),
      ]));
      const result = (await findTool.execute({ email: "bob@example.com" })) as { found: boolean; contact?: { id: string } };
      expect(result.found).toBe(true);
      expect(result.contact!.id).toBe("c-2");
    });
  });
});
