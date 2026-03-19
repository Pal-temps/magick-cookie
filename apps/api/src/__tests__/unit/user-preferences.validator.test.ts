import { describe, it, expect } from "bun:test";
import { userPreferencesSchema } from "../../presentation/validators/user-preferences.validator";

const VALID_PREFS = {
  version: 1 as const,
  theme: { theme: "dark" as const, mode: "manual" as const, schedule: { darkStart: 20, darkEnd: 7 } },
  focus: { enabled: true },
  dashboard: { widgetOrder: ["timer", "water"], hiddenWidgets: ["vps"] },
  shortcuts: { custom: [["nav-dashboard", "Ctrl+D"]] as [string, string][] },
  brief: {
    customTemplates: [{ id: "custom-1", name: "My Template", prompt: "Do the thing" }],
    activeTemplateId: "standup-fr",
  },
  env: { customChecks: [{ name: "API", url: "http://localhost:3000" }] },
  vps: { notificationsEnabled: true },
  sidebar: { sectionOrder: ["favoris", "filtres", "contacts", "taches"] },
  rss: { retentionDays: 90 },
};

describe("userPreferencesSchema", () => {
  it("accepts valid preferences", () => {
    const result = userPreferencesSchema.safeParse(VALID_PREFS);
    expect(result.success).toBe(true);
  });

  it("accepts minimal valid preferences (empty arrays)", () => {
    const minimal = {
      ...VALID_PREFS,
      dashboard: { widgetOrder: [], hiddenWidgets: [] },
      shortcuts: { custom: [] },
      brief: { customTemplates: [], activeTemplateId: "standup-fr" },
      env: { customChecks: [] },
      sidebar: { sectionOrder: [] },
    };
    const result = userPreferencesSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  // --- version ---
  it("rejects wrong version", () => {
    const result = userPreferencesSchema.safeParse({ ...VALID_PREFS, version: 2 });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const { version, ...noVersion } = VALID_PREFS;
    const result = userPreferencesSchema.safeParse(noVersion);
    expect(result.success).toBe(false);
  });

  // --- theme ---
  it("rejects invalid theme value", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      theme: { ...VALID_PREFS.theme, theme: "rainbow" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid theme mode", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      theme: { ...VALID_PREFS.theme, mode: "super-auto" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects schedule darkStart > 23", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      theme: { ...VALID_PREFS.theme, schedule: { darkStart: 25, darkEnd: 7 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects schedule darkEnd < 0", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      theme: { ...VALID_PREFS.theme, schedule: { darkStart: 20, darkEnd: -1 } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts all three theme values", () => {
    for (const t of ["dark", "light", "cookie"]) {
      const result = userPreferencesSchema.safeParse({
        ...VALID_PREFS,
        theme: { ...VALID_PREFS.theme, theme: t },
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all three mode values", () => {
    for (const m of ["manual", "auto-system", "auto-schedule"]) {
      const result = userPreferencesSchema.safeParse({
        ...VALID_PREFS,
        theme: { ...VALID_PREFS.theme, mode: m },
      });
      expect(result.success).toBe(true);
    }
  });

  // --- focus ---
  it("rejects non-boolean focus.enabled", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      focus: { enabled: "yes" },
    });
    expect(result.success).toBe(false);
  });

  // --- dashboard ---
  it("rejects missing widgetOrder", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      dashboard: { hiddenWidgets: [] },
    });
    expect(result.success).toBe(false);
  });

  // --- shortcuts ---
  it("rejects non-tuple shortcuts", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      shortcuts: { custom: [["only-one"]] },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid shortcut tuples", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      shortcuts: { custom: [["nav-dashboard", "Ctrl+D"], ["settings", "Ctrl+,"]] },
    });
    expect(result.success).toBe(true);
  });

  // --- brief ---
  it("rejects template with missing name", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      brief: {
        customTemplates: [{ id: "t1", prompt: "hello" }],
        activeTemplateId: "t1",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects template prompt exceeding max length", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      brief: {
        customTemplates: [{ id: "t1", name: "x", prompt: "a".repeat(5001) }],
        activeTemplateId: "t1",
      },
    });
    expect(result.success).toBe(false);
  });

  // --- env ---
  it("rejects env check with missing url", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      env: { customChecks: [{ name: "API" }] },
    });
    expect(result.success).toBe(false);
  });

  // --- vps ---
  it("rejects non-boolean notificationsEnabled", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      vps: { notificationsEnabled: "true" },
    });
    expect(result.success).toBe(false);
  });

  // --- sidebar ---
  it("rejects non-array sectionOrder", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      sidebar: { sectionOrder: "favoris" },
    });
    expect(result.success).toBe(false);
  });

  // --- missing top-level sections ---
  it("rejects missing theme section", () => {
    const { theme, ...rest } = VALID_PREFS;
    const result = userPreferencesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing focus section", () => {
    const { focus, ...rest } = VALID_PREFS;
    const result = userPreferencesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing sidebar section", () => {
    const { sidebar, ...rest } = VALID_PREFS;
    const result = userPreferencesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // --- extra fields stripped ---
  it("strips unknown top-level fields", () => {
    const result = userPreferencesSchema.safeParse({
      ...VALID_PREFS,
      apiKey: "sk-secret-should-not-pass",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).apiKey).toBeUndefined();
      expect((result.data as any).password).toBeUndefined();
    }
  });
});
