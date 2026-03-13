import { describe, test, expect, afterAll } from "bun:test";
import { request, closeDb } from "./setup";

afterAll(async () => {
  await closeDb();
});

describe("GET /api/health", () => {
  test("returns { status: 'ok' } with 200", async () => {
    const res = await request("GET", "/api/health");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });
});
