import { describe, it, expect, beforeEach, mock } from "bun:test";
import { UserPreferencesService } from "../../application/user-preferences/user-preferences.service";
import type { UserPreferencesRepository } from "../../domain/user-preferences/user-preferences.repository";
import type { UserPreferencesEntity } from "../../domain/user-preferences/user-preferences.entity";

const VALID_PREFS = {
  version: 1,
  theme: { theme: "dark", mode: "manual", schedule: { darkStart: 20, darkEnd: 7 } },
  focus: { enabled: true },
  dashboard: { widgetOrder: ["timer"], hiddenWidgets: [] },
  shortcuts: { custom: [] },
  brief: { customTemplates: [], activeTemplateId: "standup-fr" },
  env: { customChecks: [] },
  vps: { notificationsEnabled: true },
  sidebar: { sectionOrder: ["favoris", "filtres"] },
};

const makeEntity = (overrides: Partial<UserPreferencesEntity> = {}): UserPreferencesEntity => ({
  id: "up-1",
  data: JSON.stringify(VALID_PREFS),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("UserPreferencesService", () => {
  let service: UserPreferencesService;
  let mockRepo: Record<keyof UserPreferencesRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      find: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve(makeEntity())),
    };
    service = new UserPreferencesService(mockRepo as unknown as UserPreferencesRepository);
  });

  // --- get ---
  it("get returns null when no preferences exist", async () => {
    const result = await service.get();
    expect(result).toBeNull();
    expect(mockRepo.find).toHaveBeenCalledTimes(1);
  });

  it("get returns parsed preferences when they exist", async () => {
    mockRepo.find.mockReturnValue(Promise.resolve(makeEntity()));

    const result = await service.get();

    expect(result).toEqual(VALID_PREFS);
    expect(mockRepo.find).toHaveBeenCalledTimes(1);
  });

  it("get returns null when data is invalid JSON", async () => {
    mockRepo.find.mockReturnValue(Promise.resolve(makeEntity({ data: "not json{" })));

    const result = await service.get();

    expect(result).toBeNull();
  });

  // --- save ---
  it("save serializes and upserts preferences", async () => {
    const result = await service.save(VALID_PREFS);

    expect(result).toEqual(VALID_PREFS);
    expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
    expect(mockRepo.upsert).toHaveBeenCalledWith({ data: JSON.stringify(VALID_PREFS) });
  });

  it("save returns the saved data", async () => {
    const customPrefs = { ...VALID_PREFS, focus: { enabled: false } };
    mockRepo.upsert.mockReturnValue(Promise.resolve(makeEntity({ data: JSON.stringify(customPrefs) })));

    const result = await service.save(customPrefs);

    expect(result).toEqual(customPrefs);
  });
});
