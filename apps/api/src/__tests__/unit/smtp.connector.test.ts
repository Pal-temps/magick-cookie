import { describe, test, expect, beforeEach } from "bun:test";
import { SmtpConnector } from "../../infrastructure/connectors/smtp.connector";
import type { EmailAccount, SendEmailInput } from "../../domain/email/email.entity";

function makeAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  return {
    id: "acc-1",
    label: "Perso",
    email: "john@gmail.com",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    username: "john@gmail.com",
    selfSigned: false,
    lastSyncedAt: null,
    syncEnabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("SmtpConnector", () => {
  let connector: SmtpConnector;

  beforeEach(() => {
    connector = new SmtpConnector();
  });

  describe("sendEmail", () => {
    test("rejects when SMTP server is unreachable", async () => {
      const account = makeAccount({ smtpHost: "127.0.0.1", smtpPort: 19999 });
      const input: SendEmailInput = {
        to: ["alice@example.com"],
        subject: "Test",
        bodyText: "Hello",
      };

      await expect(connector.sendEmail(account, "password", input)).rejects.toThrow();
    });
  });

  describe("testConnection", () => {
    test("returns false when SMTP server is unreachable", async () => {
      const result = await connector.testConnection({
        host: "127.0.0.1",
        port: 19999,
        secure: false,
        username: "test",
        password: "test",
      });
      expect(result).toBe(false);
    });

    test("returns false with selfSigned option", async () => {
      const result = await connector.testConnection({
        host: "127.0.0.1",
        port: 19999,
        secure: false,
        username: "test",
        password: "test",
        selfSigned: true,
      });
      expect(result).toBe(false);
    });
  });
});
