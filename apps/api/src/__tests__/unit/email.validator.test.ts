import { describe, test, expect } from "bun:test";
import {
  createEmailAccountSchema,
  updateEmailAccountSchema,
  updateEmailFlagsSchema,
  emailQuerySchema,
  sendEmailSchema,
} from "../../presentation/validators/email.validator";

describe("createEmailAccountSchema", () => {
  const validInput = {
    label: "Perso",
    email: "john@gmail.com",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    username: "john@gmail.com",
    password: "app-password-123",
  };

  test("accepts valid input", () => {
    const result = createEmailAccountSchema.parse(validInput);
    expect(result.label).toBe("Perso");
    expect(result.email).toBe("john@gmail.com");
    expect(result.imapHost).toBe("imap.gmail.com");
  });

  test("applies default ports", () => {
    const { imapPort, smtpPort, ...rest } = validInput;
    const result = createEmailAccountSchema.parse(rest);
    expect(result.imapPort).toBe(993);
    expect(result.smtpPort).toBe(587);
  });

  test("rejects empty label", () => {
    expect(() => createEmailAccountSchema.parse({ ...validInput, label: "" })).toThrow();
  });

  test("rejects invalid email", () => {
    expect(() => createEmailAccountSchema.parse({ ...validInput, email: "not-an-email" })).toThrow();
  });

  test("rejects empty password", () => {
    expect(() => createEmailAccountSchema.parse({ ...validInput, password: "" })).toThrow();
  });

  test("rejects port out of range", () => {
    expect(() => createEmailAccountSchema.parse({ ...validInput, imapPort: 0 })).toThrow();
    expect(() => createEmailAccountSchema.parse({ ...validInput, imapPort: 99999 })).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => createEmailAccountSchema.parse({})).toThrow();
    expect(() => createEmailAccountSchema.parse({ label: "test" })).toThrow();
  });
});

describe("updateEmailAccountSchema", () => {
  test("accepts partial update with label only", () => {
    const result = updateEmailAccountSchema.parse({ label: "Pro" });
    expect(result.label).toBe("Pro");
    expect(result.syncEnabled).toBeUndefined();
  });

  test("accepts syncEnabled only", () => {
    const result = updateEmailAccountSchema.parse({ syncEnabled: false });
    expect(result.syncEnabled).toBe(false);
  });

  test("accepts empty object", () => {
    const result = updateEmailAccountSchema.parse({});
    expect(result).toEqual({});
  });

  test("rejects empty label", () => {
    expect(() => updateEmailAccountSchema.parse({ label: "" })).toThrow();
  });
});

describe("updateEmailFlagsSchema", () => {
  test("accepts isRead", () => {
    const result = updateEmailFlagsSchema.parse({ isRead: true });
    expect(result.isRead).toBe(true);
  });

  test("accepts isStarred", () => {
    const result = updateEmailFlagsSchema.parse({ isStarred: false });
    expect(result.isStarred).toBe(false);
  });

  test("accepts isArchived", () => {
    const result = updateEmailFlagsSchema.parse({ isArchived: true });
    expect(result.isArchived).toBe(true);
  });

  test("accepts multiple flags", () => {
    const result = updateEmailFlagsSchema.parse({ isRead: true, isStarred: true, isArchived: false });
    expect(result.isRead).toBe(true);
    expect(result.isStarred).toBe(true);
    expect(result.isArchived).toBe(false);
  });

  test("accepts empty object", () => {
    const result = updateEmailFlagsSchema.parse({});
    expect(result).toEqual({});
  });
});

describe("emailQuerySchema", () => {
  test("applies defaults", () => {
    const result = emailQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  test("accepts all filter options", () => {
    const result = emailQuerySchema.parse({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      folder: "INBOX",
      unread: "true",
      limit: "20",
      offset: "10",
    });
    expect(result.accountId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.folder).toBe("INBOX");
    expect(result.unread).toBe(true);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(10);
  });

  test("coerces string numbers", () => {
    const result = emailQuerySchema.parse({ limit: "100", offset: "25" });
    expect(result.limit).toBe(100);
    expect(result.offset).toBe(25);
  });

  test("rejects limit over 200", () => {
    expect(() => emailQuerySchema.parse({ limit: "500" })).toThrow();
  });

  test("rejects negative offset", () => {
    expect(() => emailQuerySchema.parse({ offset: "-1" })).toThrow();
  });

  test("rejects invalid UUID for accountId", () => {
    expect(() => emailQuerySchema.parse({ accountId: "not-a-uuid" })).toThrow();
  });
});

describe("createEmailAccountSchema — selfSigned", () => {
  const validInput = {
    label: "Self-hosted",
    email: "me@mail.localhost.com",
    imapHost: "localhost",
    imapPort: 1993,
    imapSecure: true,
    smtpHost: "localhost",
    smtpPort: 1587,
    smtpSecure: false,
    username: "me@localhost",
    password: "changeme",
  };

  test("defaults selfSigned to false", () => {
    const result = createEmailAccountSchema.parse(validInput);
    expect(result.selfSigned).toBe(false);
  });

  test("accepts selfSigned: true", () => {
    const result = createEmailAccountSchema.parse({ ...validInput, selfSigned: true });
    expect(result.selfSigned).toBe(true);
  });
});

describe("sendEmailSchema", () => {
  const validInput = {
    accountId: "550e8400-e29b-41d4-a716-446655440000",
    to: ["alice@example.com"],
    subject: "Hello",
    bodyText: "Hi Alice",
  };

  test("accepts valid input", () => {
    const result = sendEmailSchema.parse(validInput);
    expect(result.to).toEqual(["alice@example.com"]);
    expect(result.subject).toBe("Hello");
    expect(result.bodyText).toBe("Hi Alice");
  });

  test("accepts multiple recipients", () => {
    const result = sendEmailSchema.parse({ ...validInput, to: ["a@b.com", "c@d.com"] });
    expect(result.to).toHaveLength(2);
  });

  test("accepts cc", () => {
    const result = sendEmailSchema.parse({ ...validInput, cc: ["bob@example.com"] });
    expect(result.cc).toEqual(["bob@example.com"]);
  });

  test("accepts bodyHtml", () => {
    const result = sendEmailSchema.parse({ ...validInput, bodyHtml: "<p>Hi</p>" });
    expect(result.bodyHtml).toBe("<p>Hi</p>");
  });

  test("rejects empty to array", () => {
    expect(() => sendEmailSchema.parse({ ...validInput, to: [] })).toThrow();
  });

  test("rejects invalid email in to", () => {
    expect(() => sendEmailSchema.parse({ ...validInput, to: ["not-an-email"] })).toThrow();
  });

  test("rejects missing accountId", () => {
    const { accountId, ...rest } = validInput;
    expect(() => sendEmailSchema.parse(rest)).toThrow();
  });

  test("rejects invalid UUID for accountId", () => {
    expect(() => sendEmailSchema.parse({ ...validInput, accountId: "not-uuid" })).toThrow();
  });

  test("rejects empty bodyText", () => {
    expect(() => sendEmailSchema.parse({ ...validInput, bodyText: "" })).toThrow();
  });
});
