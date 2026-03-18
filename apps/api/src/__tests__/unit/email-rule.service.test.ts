import { describe, it, expect, beforeEach, mock } from "bun:test";
import { EmailRuleService } from "../../application/email/email-rule.service";
import type { EmailRuleRepository } from "../../domain/email/email-rule.repository";
import type { EmailRule } from "../../domain/email/email-rule.entity";
import type { Email } from "../../domain/email/email.entity";

const makeRule = (overrides: Partial<EmailRule> = {}): EmailRule => ({
  id: "r-1",
  name: "Newsletter filter",
  conditionField: "from",
  conditionOperator: "contains",
  conditionValue: "newsletter",
  actionType: "classify",
  actionValue: "newsletter",
  enabled: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeEmail = (overrides: Partial<Email> = {}): Email => ({
  id: "e-1",
  accountId: "acct-1",
  messageId: "msg-1",
  imapUid: 100,
  subject: "Hello World",
  fromAddress: "alice@example.com",
  fromName: "Alice",
  toAddresses: [{ name: null, address: "me@test.com" }],
  ccAddresses: [],
  bodyText: "Body text",
  bodyHtml: null,
  hasAttachments: false,
  attachmentNames: [],
  isRead: false,
  isStarred: false,
  isArchived: false,
  folder: "INBOX",
  summary: null,
  classification: null,
  sentAt: new Date("2026-01-15"),
  createdAt: new Date("2026-01-15"),
  ...overrides,
});

describe("EmailRuleService", () => {
  let service: EmailRuleService;
  let mockRepo: Record<keyof EmailRuleRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findById: mock(() => Promise.resolve(null)),
      findEnabled: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeRule())),
      update: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(false)),
    };
    service = new EmailRuleService(mockRepo as unknown as EmailRuleRepository);
  });

  // --- CRUD ---
  it("getRules returns all rules", async () => {
    const rules = [makeRule(), makeRule({ id: "r-2", name: "Spam" })];
    mockRepo.findAll.mockReturnValue(Promise.resolve(rules));

    const result = await service.getRules();

    expect(result).toEqual(rules);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it("getRules returns empty array when none", async () => {
    const result = await service.getRules();
    expect(result).toEqual([]);
  });

  it("getRuleById returns rule when found", async () => {
    const rule = makeRule();
    mockRepo.findById.mockReturnValue(Promise.resolve(rule));

    const result = await service.getRuleById("r-1");

    expect(result).toEqual(rule);
    expect(mockRepo.findById).toHaveBeenCalledWith("r-1");
  });

  it("getRuleById returns null when not found", async () => {
    const result = await service.getRuleById("missing");
    expect(result).toBeNull();
  });

  it("createRule delegates to repo", async () => {
    const input = {
      name: "Filter",
      conditionField: "from" as const,
      conditionOperator: "contains" as const,
      conditionValue: "test",
      actionType: "classify" as const,
      actionValue: "test",
    };
    const created = makeRule({ name: "Filter" });
    mockRepo.create.mockReturnValue(Promise.resolve(created));

    const result = await service.createRule(input);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("updateRule returns updated rule when found", async () => {
    const updated = makeRule({ name: "Updated" });
    mockRepo.update.mockReturnValue(Promise.resolve(updated));

    const result = await service.updateRule("r-1", { name: "Updated" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("r-1", { name: "Updated" });
  });

  it("updateRule returns null when not found", async () => {
    const result = await service.updateRule("missing", { name: "Nope" });
    expect(result).toBeNull();
  });

  it("deleteRule returns true when deleted", async () => {
    mockRepo.delete.mockReturnValue(Promise.resolve(true));

    const result = await service.deleteRule("r-1");

    expect(result).toBe(true);
    expect(mockRepo.delete).toHaveBeenCalledWith("r-1");
  });

  it("deleteRule returns false when not found", async () => {
    const result = await service.deleteRule("missing");
    expect(result).toBe(false);
  });

  // --- applyRules: from contains ---
  it("applyRules classifies email when from contains match", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "from",
          conditionOperator: "contains",
          conditionValue: "alice",
          actionType: "classify",
          actionValue: "personal",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail({ fromAddress: "alice@example.com" }));

    expect(result.classification).toBe("personal");
  });

  // --- applyRules: subject equals ---
  it("applyRules stars email when subject equals match", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "subject",
          conditionOperator: "equals",
          conditionValue: "hello world",
          actionType: "star",
          actionValue: "true",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail({ subject: "Hello World" }));

    expect(result.isStarred).toBe(true);
  });

  // --- applyRules: domain startsWith ---
  it("applyRules archives email when domain startsWith match", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "domain",
          conditionOperator: "startsWith",
          conditionValue: "example",
          actionType: "archive",
          actionValue: "true",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail({ fromAddress: "bob@example.com" }));

    expect(result.isArchived).toBe(true);
  });

  // --- applyRules: endsWith ---
  it("applyRules matches endsWith operator", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "from",
          conditionOperator: "endsWith",
          conditionValue: ".com",
          actionType: "classify",
          actionValue: "commercial",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail({ fromAddress: "alice@example.com" }));

    expect(result.classification).toBe("commercial");
  });

  // --- applyRules: no matching rule ---
  it("applyRules returns empty result when no rule matches", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "from",
          conditionOperator: "contains",
          conditionValue: "nonexistent",
          actionType: "classify",
          actionValue: "spam",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail({ fromAddress: "alice@example.com" }));

    expect(result).toEqual({});
  });

  it("applyRules returns empty result when no rules enabled", async () => {
    const result = await service.applyRules(makeEmail());
    expect(result).toEqual({});
  });

  // --- applyRules: multiple rules ---
  it("applyRules applies multiple matching rules", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          id: "r-1",
          conditionField: "from",
          conditionOperator: "contains",
          conditionValue: "alice",
          actionType: "classify",
          actionValue: "personal",
        }),
        makeRule({
          id: "r-2",
          conditionField: "subject",
          conditionOperator: "contains",
          conditionValue: "hello",
          actionType: "star",
          actionValue: "true",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail());

    expect(result.classification).toBe("personal");
    expect(result.isStarred).toBe(true);
  });

  // --- applyRules: null subject ---
  it("applyRules handles null subject", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "subject",
          conditionOperator: "equals",
          conditionValue: "",
          actionType: "archive",
          actionValue: "true",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail({ subject: null }));

    expect(result.isArchived).toBe(true);
  });

  // --- applyRules: star false ---
  it("applyRules sets isStarred false when action value is not true", async () => {
    mockRepo.findEnabled.mockReturnValue(
      Promise.resolve([
        makeRule({
          conditionField: "from",
          conditionOperator: "contains",
          conditionValue: "alice",
          actionType: "star",
          actionValue: "false",
        }),
      ]),
    );

    const result = await service.applyRules(makeEmail());

    expect(result.isStarred).toBe(false);
  });
});
