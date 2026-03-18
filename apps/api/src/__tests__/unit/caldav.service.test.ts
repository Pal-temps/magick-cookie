import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CalDavService } from "../../application/caldav/caldav.service";
import type { CalDavAccountRepository } from "../../domain/caldav/caldav.repository";
import type { CalDavAccount } from "../../domain/caldav/caldav.entity";
import type { CalDavConnector } from "../../infrastructure/connectors/caldav.connector";
import type { EventRepository } from "../../domain/event/event.repository";

const makeAccount = (overrides: Partial<CalDavAccount> = {}): CalDavAccount => ({
  id: "acc-1",
  label: "My CalDAV",
  url: "https://cal.example.com/dav",
  username: "user",
  calendarId: "cal-1",
  lastSyncedAt: null,
  syncEnabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("CalDavService", () => {
  let service: CalDavService;
  let mockAccountRepo: Record<keyof CalDavAccountRepository, ReturnType<typeof mock>>;
  let mockConnector: Record<keyof CalDavConnector, ReturnType<typeof mock>>;
  let mockEventRepo: Record<string, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockAccountRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findActive: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeAccount())),
      update: mock(() => Promise.resolve(null)),
      updateLastSyncedAt: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(false)),
      getPassword: mock(() => Promise.resolve(null)),
    };
    mockConnector = {
      fetchEvents: mock(() => Promise.resolve([])),
      parseIcs: mock(() => []),
      testConnection: mock(() => Promise.resolve(true)),
    };
    mockEventRepo = {
      findAll: mock(() => Promise.resolve([])),
      findByCalendarId: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByTaskId: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({})),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      countByDateRange: mock(() => Promise.resolve({ total: 0, dailyStats: [] })),
    };
    service = new CalDavService(
      mockAccountRepo as unknown as CalDavAccountRepository,
      mockConnector as unknown as CalDavConnector,
      mockEventRepo as unknown as EventRepository,
    );
  });

  // --- getAccounts ---
  it("getAccounts returns all accounts", async () => {
    const accounts = [makeAccount(), makeAccount({ id: "acc-2", label: "Work" })];
    mockAccountRepo.findAll.mockReturnValue(Promise.resolve(accounts));

    const result = await service.getAccounts();

    expect(result).toEqual(accounts);
    expect(mockAccountRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAccounts returns empty array when none", async () => {
    const result = await service.getAccounts();
    expect(result).toEqual([]);
  });

  // --- getAccountById ---
  it("getAccountById returns account when found", async () => {
    const account = makeAccount();
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(account));

    const result = await service.getAccountById("acc-1");

    expect(result).toEqual(account);
    expect(mockAccountRepo.findById).toHaveBeenCalledWith("acc-1");
  });

  it("getAccountById returns null when not found", async () => {
    const result = await service.getAccountById("missing");
    expect(result).toBeNull();
  });

  // --- createAccount ---
  it("createAccount delegates to repo and returns account", async () => {
    const input = { label: "New", url: "https://cal.example.com", username: "u", password: "p" };
    const created = makeAccount({ label: "New" });
    mockAccountRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.createAccount(input);

    expect(result).toEqual(created);
    expect(mockAccountRepo.create).toHaveBeenCalledWith(input);
  });

  // --- updateAccount ---
  it("updateAccount returns updated account when found", async () => {
    const updated = makeAccount({ label: "Updated" });
    mockAccountRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.updateAccount("acc-1", { label: "Updated" });

    expect(result).toEqual(updated);
    expect(mockAccountRepo.update).toHaveBeenCalledWith("acc-1", { label: "Updated" });
  });

  it("updateAccount returns null when not found", async () => {
    const result = await service.updateAccount("missing", { label: "Nope" });
    expect(result).toBeNull();
  });

  // --- deleteAccount ---
  it("deleteAccount returns true when deleted", async () => {
    mockAccountRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.deleteAccount("acc-1");

    expect(result).toBe(true);
    expect(mockAccountRepo.delete).toHaveBeenCalledWith("acc-1");
  });

  it("deleteAccount returns false when not found", async () => {
    const result = await service.deleteAccount("missing");
    expect(result).toBe(false);
  });

  // --- syncAccount success ---
  it("syncAccount imports events from connector", async () => {
    const account = makeAccount();
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(account));
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
    mockConnector.fetchEvents.mockReturnValue(
      Promise.resolve([
        {
          uid: "e1",
          summary: "Meeting",
          dtstart: new Date("2026-02-01T10:00:00Z"),
          dtend: new Date("2026-02-01T11:00:00Z"),
          description: "Standup",
          location: "Room A",
        },
        {
          uid: "e2",
          summary: "Lunch",
          dtstart: new Date("2026-02-01T12:00:00Z"),
          dtend: new Date("2026-02-01T13:00:00Z"),
          description: null,
          location: null,
        },
      ]),
    );
    mockEventRepo.create.mockReturnValue(Promise.resolve({}));

    const result = await service.syncAccount("acc-1");

    expect(result).toEqual({ imported: 2, updated: 0 });
    expect(mockEventRepo.create).toHaveBeenCalledTimes(2);
    expect(mockAccountRepo.updateLastSyncedAt).toHaveBeenCalledTimes(1);
    expect(mockAccountRepo.updateLastSyncedAt.mock.calls[0][0]).toBe("acc-1");
  });

  it("syncAccount counts failed creates as updated", async () => {
    const account = makeAccount();
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(account));
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
    mockConnector.fetchEvents.mockReturnValue(
      Promise.resolve([
        {
          uid: "e1",
          summary: "Meeting",
          dtstart: new Date("2026-02-01T10:00:00Z"),
          dtend: new Date("2026-02-01T11:00:00Z"),
          description: null,
          location: null,
        },
      ]),
    );
    mockEventRepo.create.mockReturnValue(Promise.reject(new Error("duplicate")));

    const result = await service.syncAccount("acc-1");

    expect(result).toEqual({ imported: 0, updated: 1 });
  });

  it("syncAccount skips events without dtstart or dtend", async () => {
    const account = makeAccount();
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(account));
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
    mockConnector.fetchEvents.mockReturnValue(
      Promise.resolve([
        { uid: "e1", summary: "Bad", dtstart: null, dtend: null, description: null, location: null },
        { uid: "e2", summary: "Partial", dtstart: new Date(), dtend: null, description: null, location: null },
      ]),
    );

    const result = await service.syncAccount("acc-1");

    expect(result).toEqual({ imported: 0, updated: 0 });
    expect(mockEventRepo.create).not.toHaveBeenCalled();
  });

  // --- syncAccount not found ---
  it("syncAccount throws when account not found", async () => {
    await expect(service.syncAccount("missing")).rejects.toThrow("CalDAV account not found");
  });

  it("syncAccount throws when no calendarId assigned", async () => {
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(makeAccount({ calendarId: null })));

    await expect(service.syncAccount("acc-1")).rejects.toThrow("No calendar assigned to CalDAV account");
  });

  it("syncAccount throws when password not found", async () => {
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve(null));

    await expect(service.syncAccount("acc-1")).rejects.toThrow("CalDAV account password not found");
  });

  // --- syncAccount connector error ---
  it("syncAccount propagates connector error", async () => {
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
    mockConnector.fetchEvents.mockReturnValue(Promise.reject(new Error("CalDAV error 401")));

    await expect(service.syncAccount("acc-1")).rejects.toThrow("CalDAV error 401");
  });

  // --- testConnection ---
  it("testConnection delegates to connector", async () => {
    mockConnector.testConnection.mockReturnValue(Promise.resolve(true));
    const input = { label: "Test", url: "https://cal.example.com", username: "u", password: "p" };

    const result = await service.testConnection(input);

    expect(result).toBe(true);
    expect(mockConnector.testConnection).toHaveBeenCalledWith(input.url, input.username, input.password);
  });

  // --- syncAll ---
  it("syncAll syncs all active accounts", async () => {
    const accounts = [makeAccount(), makeAccount({ id: "acc-2", label: "Work" })];
    mockAccountRepo.findActive.mockReturnValue(Promise.resolve(accounts));
    mockAccountRepo.findById.mockImplementation((id: string) =>
      Promise.resolve(accounts.find((a) => a.id === id) || null),
    );
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
    mockConnector.fetchEvents.mockReturnValue(
      Promise.resolve([
        {
          uid: "e1",
          summary: "Event",
          dtstart: new Date("2026-02-01T10:00:00Z"),
          dtend: new Date("2026-02-01T11:00:00Z"),
          description: null,
          location: null,
        },
      ]),
    );
    mockEventRepo.create.mockReturnValue(Promise.resolve({}));

    const result = await service.syncAll();

    expect(result.total).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("syncAll skips accounts without calendarId", async () => {
    const accounts = [makeAccount({ calendarId: null })];
    mockAccountRepo.findActive.mockReturnValue(Promise.resolve(accounts));

    const result = await service.syncAll();

    expect(result.total).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("syncAll collects errors for failed accounts", async () => {
    const accounts = [makeAccount()];
    mockAccountRepo.findActive.mockReturnValue(Promise.resolve(accounts));
    mockAccountRepo.findById.mockReturnValue(Promise.resolve(makeAccount()));
    mockAccountRepo.getPassword.mockReturnValue(Promise.resolve("secret"));
    mockConnector.fetchEvents.mockReturnValue(Promise.reject(new Error("network failure")));

    const result = await service.syncAll();

    expect(result.total).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("My CalDAV");
    expect(result.errors[0]).toContain("network failure");
  });
});
