import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createUserPreferencesRoutes } from "../../presentation/routes/user-preferences.routes";
import type { UserPreferencesService } from "../../application/user-preferences/user-preferences.service";

const VALID_PREFS = {
  version: 1,
  theme: { theme: "dark", mode: "manual", schedule: { darkStart: 20, darkEnd: 7 } },
  focus: { enabled: true },
  dashboard: { widgetOrder: ["timer"], hiddenWidgets: [] },
  shortcuts: { custom: [] },
  brief: { customTemplates: [], activeTemplateId: "standup-fr" },
  env: { customChecks: [] },
  vps: { notificationsEnabled: true },
  sidebar: { sectionOrder: ["favoris"] },
};

describe("user-preferences routes", () => {
  let app: Hono;
  let mockService: Record<keyof UserPreferencesService, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockService = {
      get: mock(() => Promise.resolve(null)),
      save: mock(() => Promise.resolve(VALID_PREFS)),
    };
    app = new Hono();
    app.route("/api/user-preferences", createUserPreferencesRoutes(mockService as unknown as UserPreferencesService));
  });

  // --- GET ---
  it("GET returns null when no preferences", async () => {
    const res = await app.request("/api/user-preferences");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeNull();
  });

  it("GET returns preferences when they exist", async () => {
    mockService.get.mockReturnValue(Promise.resolve(VALID_PREFS));

    const res = await app.request("/api/user-preferences");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(VALID_PREFS);
  });

  // --- PUT ---
  it("PUT saves valid preferences", async () => {
    const res = await app.request("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_PREFS),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(VALID_PREFS);
    expect(mockService.save).toHaveBeenCalledTimes(1);
  });

  it("PUT rejects invalid body (missing version)", async () => {
    const { version, ...noVersion } = VALID_PREFS;
    const res = await app.request("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noVersion),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mockService.save).not.toHaveBeenCalled();
  });

  it("PUT rejects invalid theme value", async () => {
    const res = await app.request("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...VALID_PREFS,
        theme: { ...VALID_PREFS.theme, theme: "rainbow" },
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mockService.save).not.toHaveBeenCalled();
  });

  it("PUT rejects empty body", async () => {
    const res = await app.request("/api/user-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
