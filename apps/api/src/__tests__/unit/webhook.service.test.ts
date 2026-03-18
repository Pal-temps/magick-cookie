import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WebhookService } from "../../application/webhook/webhook.service";
import type { WebhookRepository } from "../../domain/webhook/webhook.repository";
import type { Webhook, WebhookEvent } from "../../domain/webhook/webhook.entity";

const makeWebhook = (overrides: Partial<Webhook> = {}): Webhook => ({
  id: "wh-1",
  name: "GitHub Push",
  secret: "abc123secret",
  source: "github",
  enabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
  id: "ev-1",
  webhookId: "wh-1",
  payload: '{"action":"push"}',
  receivedAt: new Date("2026-01-15"),
  readAt: null,
  ...overrides,
});

describe("WebhookService", () => {
  let service: WebhookService;
  let mockRepo: Record<keyof WebhookRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve(makeWebhook())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
      findEvents: mock(() => Promise.resolve([])),
      createEvent: mock(() => Promise.resolve(makeEvent())),
      markEventRead: mock(() => Promise.resolve(null)),
    };
    service = new WebhookService(mockRepo as unknown as WebhookRepository);
  });

  // --- getAll ---
  it("getAll returns all webhooks", async () => {
    const webhooks = [makeWebhook(), makeWebhook({ id: "wh-2", name: "Stripe" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(webhooks));

    const result = await service.getAll();

    expect(result).toEqual(webhooks);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getAll returns empty array when none", async () => {
    const result = await service.getAll();
    expect(result).toEqual([]);
  });

  // --- getById ---
  it("getById returns webhook when found", async () => {
    const webhook = makeWebhook();
    mockRepo.findById.mockReturnValue(Promise.resolve(webhook));

    const result = await service.getById("wh-1");

    expect(result).toEqual(webhook);
    expect(mockRepo.findById).toHaveBeenCalledWith("wh-1");
  });

  it("getById returns null when not found", async () => {
    const result = await service.getById("missing");
    expect(result).toBeNull();
  });

  // --- create ---
  it("create generates a secret and delegates to repo", async () => {
    const input = { name: "New Hook", source: "custom" };
    const created = makeWebhook({ name: "New Hook" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.create(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    // Verify secret was generated (64 hex chars = 32 bytes)
    const callArgs = mockRepo.create.mock.calls[0][0] as { name: string; source: string; secret: string };
    expect(callArgs.name).toBe("New Hook");
    expect(callArgs.source).toBe("custom");
    expect(callArgs.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  // --- update ---
  it("update returns updated webhook when found", async () => {
    const updated = makeWebhook({ name: "Updated" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.update("wh-1", { name: "Updated" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("wh-1", { name: "Updated" });
  });

  it("update returns null when not found", async () => {
    const result = await service.update("missing", { name: "Nope" });
    expect(result).toBeNull();
  });

  // --- delete ---
  it("delete returns true when deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.delete("wh-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("wh-1");
  });

  it("delete returns false when not found", async () => {
    const result = await service.delete("missing");
    expect(result).toBe(false);
  });

  // --- receiveEvent: valid secret ---
  it("receiveEvent creates event when secret matches and webhook is enabled", async () => {
    const webhook = makeWebhook({ secret: "valid-secret" });
    mockRepo.findById.mockReturnValue(Promise.resolve(webhook));
    const event = makeEvent();
    mockRepo.createEvent.mockReturnValue(Promise.resolve(event));

    const result = await service.receiveEvent("wh-1", "valid-secret", { action: "push" });

    expect(result).toEqual(event);
    expect(mockRepo.createEvent).toHaveBeenCalledWith("wh-1", '{"action":"push"}');
  });

  // --- receiveEvent: invalid secret ---
  it("receiveEvent returns null when secret does not match", async () => {
    const webhook = makeWebhook({ secret: "valid-secret" });
    mockRepo.findById.mockReturnValue(Promise.resolve(webhook));

    const result = await service.receiveEvent("wh-1", "wrong-secret", { action: "push" });

    expect(result).toBeNull();
    expect(mockRepo.createEvent).not.toHaveBeenCalled();
  });

  it("receiveEvent returns null when webhook not found", async () => {
    const result = await service.receiveEvent("missing", "any-secret", {});

    expect(result).toBeNull();
    expect(mockRepo.createEvent).not.toHaveBeenCalled();
  });

  it("receiveEvent returns null when webhook is disabled", async () => {
    const webhook = makeWebhook({ secret: "valid-secret", enabled: false });
    mockRepo.findById.mockReturnValue(Promise.resolve(webhook));

    const result = await service.receiveEvent("wh-1", "valid-secret", { action: "push" });

    expect(result).toBeNull();
    expect(mockRepo.createEvent).not.toHaveBeenCalled();
  });

  // --- getEvents ---
  it("getEvents returns events for a webhook", async () => {
    const events = [makeEvent(), makeEvent({ id: "ev-2" })];
    mockRepo.findEvents.mockReturnValue(Promise.resolve(events));

    const result = await service.getEvents("wh-1", 10);

    expect(result).toEqual(events);
    expect(mockRepo.findEvents).toHaveBeenCalledWith("wh-1", 10);
  });

  it("getEvents returns empty array when none", async () => {
    const result = await service.getEvents("wh-1");

    expect(result).toEqual([]);
    expect(mockRepo.findEvents).toHaveBeenCalledWith("wh-1", undefined);
  });

  // --- markEventRead ---
  it("markEventRead returns updated event when found", async () => {
    const readEvent = makeEvent({ readAt: new Date("2026-01-16") });
    mockRepo.markEventRead.mockReturnValue(Promise.resolve(readEvent));

    const result = await service.markEventRead("ev-1");

    expect(result).toEqual(readEvent);
    expect(result!.readAt).not.toBeNull();
    expect(mockRepo.markEventRead).toHaveBeenCalledWith("ev-1");
  });

  it("markEventRead returns null when event not found", async () => {
    const result = await service.markEventRead("missing");
    expect(result).toBeNull();
  });
});
