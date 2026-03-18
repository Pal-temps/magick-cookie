import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ContactService } from "../../application/contact/contact.service";
import type { ContactRepository } from "../../domain/contact/contact.repository";
import type { Contact } from "../../domain/contact/contact.entity";

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: "c-1",
  name: "Alice",
  birthDate: null,
  phone: null,
  email: null,
  notes: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("ContactService", () => {
  let service: ContactService;
  let mockRepo: Record<keyof ContactRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeContact())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new ContactService(mockRepo as unknown as ContactRepository);
  });

  // --- getAll ---
  it("getAll returns all contacts", async () => {
    const contacts = [makeContact(), makeContact({ id: "c-2", name: "Bob" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(contacts));

    const result = await service.getAll();

    expect(result).toEqual(contacts);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when no contacts", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById returns contact when found", async () => {
    const contact = makeContact();
    mockRepo.findById.mockReturnValue(Promise.resolve(contact));

    const result = await service.getById("c-1");

    expect(result).toEqual(contact);
    expect(mockRepo.findById).toHaveBeenCalledWith("c-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- create ---
  it("create delegates to repo and returns contact", async () => {
    const input = { name: "Alice", email: "alice@test.com" };
    const created = makeContact({ email: "alice@test.com" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated contact when found", async () => {
    const updated = makeContact({ name: "Alice Updated" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("c-1", { name: "Alice Updated" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("c-1", { name: "Alice Updated" });
  });

  it("update returns null when contact not found", async () => {
    const result = await service.update("missing", { name: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when contact deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("c-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("c-1");
  });

  it("delete returns false when contact not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });
});
