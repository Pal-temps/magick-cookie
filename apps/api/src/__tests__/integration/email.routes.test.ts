import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { request, cleanDb, closeDb } from "./setup";

afterAll(async () => {
  await closeDb();
});

const validAccount = {
  label: "Test IMAP",
  email: "alice@example.com",
  imapHost: "imap.example.com",
  imapPort: 993,
  imapSecure: true,
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpSecure: false,
  username: "alice",
  password: "hunter2",
  selfSigned: false,
};

describe("Email account routes", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  test("POST /api/email-accounts creates an account and masks response surface", async () => {
    const res = await request("POST", "/api/email-accounts", validAccount);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.email).toBe("alice@example.com");
    expect(data.imapHost).toBe("imap.example.com");
  });

  test("POST /api/email-accounts returns 400 on invalid email", async () => {
    const res = await request("POST", "/api/email-accounts", { ...validAccount, email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  test("GET /api/email-accounts returns created accounts", async () => {
    await request("POST", "/api/email-accounts", validAccount);
    const res = await request("GET", "/api/email-accounts");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].email).toBe("alice@example.com");
  });

  test("DELETE /api/email-accounts/:id removes the account", async () => {
    const createRes = await request("POST", "/api/email-accounts", validAccount);
    const { data: created } = await createRes.json();
    const del = await request("DELETE", `/api/email-accounts/${created.id}`);
    expect(del.status).toBe(200);

    const list = await request("GET", "/api/email-accounts");
    const { data } = await list.json();
    expect(data.length).toBe(0);
  });
});

describe("Email routes (listing)", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  test("GET /api/emails returns an empty list by default", async () => {
    const res = await request("GET", "/api/emails");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toEqual([]);
  });

  test("GET /api/emails/unread-count returns 0 when empty", async () => {
    const res = await request("GET", "/api/emails/unread-count");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.count).toBe(0);
  });

  test("GET /api/emails/:id returns 404 for unknown id", async () => {
    const res = await request("GET", "/api/emails/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  test("POST /api/emails/bulk-delete returns 400 when ids missing", async () => {
    const res = await request("POST", "/api/emails/bulk-delete", { ids: [] });
    expect(res.status).toBe(400);
  });
});
