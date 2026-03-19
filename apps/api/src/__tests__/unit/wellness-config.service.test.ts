import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WellnessConfigService } from "../../application/wellness-config/wellness-config.service";
import type { WellnessConfigRepository } from "../../domain/wellness-config/wellness-config.repository";
import type { WellnessConfig } from "../../domain/wellness-config/wellness-config.entity";

const makeConfig = (overrides: Partial<WellnessConfig> = {}): WellnessConfig => ({
  id: "wc-1",
  type: "water",
  label: "Boire de l'eau",
  intervalMinutes: 45,
  enabled: true,
  alertSound: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("WellnessConfigService", () => {
  let service: WellnessConfigService;
  let mockRepo: Record<keyof WellnessConfigRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findByType: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeConfig())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new WellnessConfigService(mockRepo as unknown as WellnessConfigRepository);
  });

  // --- getAll ---
  it("getAll returns all configs", async () => {
    const configs = [makeConfig(), makeConfig({ id: "wc-2", type: "break" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(configs));

    const result = await service.getAll();

    expect(result).toEqual(configs);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when no configs", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- create ---
  it("create delegates to repo and returns config", async () => {
    const input = { type: "water", label: "Drink water", intervalMinutes: 45 };
    const created = makeConfig();
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  // --- update ---
  it("update returns updated config when found", async () => {
    const updated = makeConfig({ label: "Updated label" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("wc-1", { label: "Updated label" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("wc-1", { label: "Updated label" });
  });

  it("update returns null when config not found", async () => {
    const result = await service.update("missing", { label: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when config deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("wc-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("wc-1");
  });

  it("delete returns false when config not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });

  // --- seedDefaults ---
  it("seedDefaults creates 4 default configs when none exist", async () => {
    mockRepo.findAll.mockReturnValue(Promise.resolve([]));

    await service.seedDefaults();

    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledTimes(4);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "water", label: "Boire de l'eau", intervalMinutes: 45, enabled: true }),
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "break", label: "Faire une pause", intervalMinutes: 90, enabled: true }),
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "stretch", label: "S'étirer", intervalMinutes: 60, enabled: false }),
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "breathe", label: "Respirer profondément", intervalMinutes: 120, enabled: false }),
    );
  });

  it("seedDefaults does nothing when configs already exist", async () => {
    mockRepo.findAll.mockReturnValue(Promise.resolve([makeConfig()]));

    await service.seedDefaults();

    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // --- alertSound ---
  it("create passes alertSound to repo", async () => {
    const input = { type: "water", label: "Drink", intervalMinutes: 30, alertSound: "cockatiel" };
    const created = makeConfig({ alertSound: "cockatiel" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result.alertSound).toBe("cockatiel");
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("create defaults alertSound to null when not provided", async () => {
    const input = { type: "water", label: "Drink", intervalMinutes: 30 };
    mockRepo.create.mockReturnValue(Promise.resolve(makeConfig()));

    const result = await service.create(input);

    expect(result.alertSound).toBeNull();
  });

  it("update can change alertSound", async () => {
    const updated = makeConfig({ alertSound: "alarm" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("wc-1", { alertSound: "alarm" });

    expect(result?.alertSound).toBe("alarm");
    expect(mockRepo.update).toHaveBeenCalledWith("wc-1", { alertSound: "alarm" });
  });

  it("update can set alertSound to null", async () => {
    const updated = makeConfig({ alertSound: null });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("wc-1", { alertSound: null });

    expect(result?.alertSound).toBeNull();
    expect(mockRepo.update).toHaveBeenCalledWith("wc-1", { alertSound: null });
  });
});
