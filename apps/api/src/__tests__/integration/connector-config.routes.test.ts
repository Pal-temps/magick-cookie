import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { request, cleanDb, closeDb } from "./setup";

afterAll(async () => {
  await closeDb();
});

describe("Connector config routes", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  test("GET /api/connector-configs returns empty list initially", async () => {
    const res = await request("GET", "/api/connector-configs");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toEqual([]);
  });

  test("PUT /api/connector-configs/:type upserts and masks the token", async () => {
    const res = await request("PUT", "/api/connector-configs/clickup", {
      token: "pk_1234567890abcdef",
      settings: { teamId: "42" },
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.type).toBe("clickup");
    expect(data.token).toBeUndefined();
    expect(data.tokenPreview).toBe("pk_1...cdef");
    expect(data.settings).toEqual({ teamId: "42" });
  });

  test("GET /api/connector-configs/:type returns masked token", async () => {
    await request("PUT", "/api/connector-configs/clickup", {
      token: "pk_abcdefghijkl",
      settings: {},
    });
    const res = await request("GET", "/api/connector-configs/clickup");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.token).toBeUndefined();
    expect(data.tokenPreview).toMatch(/\.\.\./);
  });

  test("GET /api/connector-configs/:type returns 400 for invalid type", async () => {
    const res = await request("GET", "/api/connector-configs/bogus-provider");
    expect(res.status).toBe(400);
  });

  test("DELETE /api/connector-configs/:type removes the config", async () => {
    await request("PUT", "/api/connector-configs/clickup", { token: "pk_xxxx", settings: {} });
    const del = await request("DELETE", "/api/connector-configs/clickup");
    expect(del.status).toBe(200);

    const get = await request("GET", "/api/connector-configs/clickup");
    expect(get.status).toBe(404);
  });

  test("PUT /api/connector-configs/:type returns 400 when token is missing", async () => {
    const res = await request("PUT", "/api/connector-configs/clickup", { settings: {} });
    expect(res.status).toBe(400);
  });
});
