import { describe, test, expect } from "bun:test";

// ─── Types (mirrored from AiToolsSettings.tsx) ───────────────────────────────

type PermissionLevel = "auto" | "user-confirm" | "admin";

interface AiToolEntry {
  name: string;
  description: string;
  category: string;
  permissionLevel: PermissionLevel;
  disabled: boolean;
}

// ─── Logic extracted from AiToolsSettings.tsx ─────────────────────────────────

const CATEGORY_ORDER = [
  "calendar", "tasks", "notes", "contacts", "email",
  "github", "gitlab", "git", "ssh", "dns",
  "analytics", "brief", "rss", "bookmarks", "snippets",
  "skills", "routines", "alarms", "timer", "memory",
  "deploy", "clickup", "infra", "other",
];

function categorySort(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function filterTools(tools: AiToolEntry[], query: string): AiToolEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return tools;
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q),
  );
}

function groupTools(tools: AiToolEntry[]): [string, AiToolEntry[]][] {
  const map = new Map<string, AiToolEntry[]>();
  for (const tool of tools) {
    const cat = tool.category || "other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(tool);
  }
  return [...map.entries()].sort(([a], [b]) => categorySort(a, b));
}

function toggleTool(
  tools: AiToolEntry[],
  name: string,
  nowDisabled: boolean,
): { updated: AiToolEntry[]; disabledList: string[] } {
  const updated = tools.map((t) =>
    t.name === name ? { ...t, disabled: nowDisabled } : t,
  );
  const disabledList = updated.filter((t) => t.disabled).map((t) => t.name);
  return { updated, disabledList };
}

function setAllTools(
  tools: AiToolEntry[],
  disable: boolean,
): { updated: AiToolEntry[]; disabledList: string[] } {
  const updated = tools.map((t) => ({ ...t, disabled: disable }));
  const disabledList = disable ? updated.map((t) => t.name) : [];
  return { updated, disabledList };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTool(overrides: Partial<AiToolEntry> = {}): AiToolEntry {
  return {
    name: "test_tool",
    description: "A test tool",
    category: "other",
    permissionLevel: "auto",
    disabled: false,
    ...overrides,
  };
}

// ─── categorySort ─────────────────────────────────────────────────────────────

describe("categorySort", () => {
  test("known categories are ordered by CATEGORY_ORDER", () => {
    const categories = ["other", "tasks", "calendar", "notes"];
    const sorted = [...categories].sort(categorySort);
    expect(sorted).toEqual(["calendar", "tasks", "notes", "other"]);
  });

  test("calendar comes before all other known categories", () => {
    expect(categorySort("calendar", "tasks")).toBeLessThan(0);
    expect(categorySort("calendar", "other")).toBeLessThan(0);
    expect(categorySort("calendar", "deploy")).toBeLessThan(0);
  });

  test("unknown categories are sorted alphabetically after known ones", () => {
    expect(categorySort("unknown-z", "calendar")).toBeGreaterThan(0);
    expect(categorySort("unknown-z", "other")).toBeGreaterThan(0);
  });

  test("two unknown categories fall back to localeCompare", () => {
    expect(categorySort("alpha", "beta")).toBeLessThan(0);
    expect(categorySort("beta", "alpha")).toBeGreaterThan(0);
    expect(categorySort("same", "same")).toBe(0);
  });

  test("'other' is last among known categories", () => {
    const knownLast = CATEGORY_ORDER[CATEGORY_ORDER.length - 1];
    expect(knownLast).toBe("other");
    // "other" should come after all other known categories
    expect(categorySort("other", "calendar")).toBeGreaterThan(0);
    expect(categorySort("other", "infra")).toBeGreaterThan(0);
  });

  test("'other' comes before truly unknown categories", () => {
    expect(categorySort("other", "zzz-unknown")).toBeLessThan(0);
  });
});

// ─── filterTools ──────────────────────────────────────────────────────────────

describe("filterTools", () => {
  const tools: AiToolEntry[] = [
    makeTool({ name: "calendar_create", description: "Create a calendar event", category: "calendar" }),
    makeTool({ name: "task_create", description: "Create a task in TaskJar", category: "tasks" }),
    makeTool({ name: "notes_search", description: "Search notes in the vault", category: "notes" }),
    makeTool({ name: "git_commit", description: "Commit changes to git", category: "git" }),
  ];

  test("empty query returns all tools", () => {
    expect(filterTools(tools, "")).toHaveLength(4);
    expect(filterTools(tools, "   ")).toHaveLength(4);
  });

  test("matches by tool name (exact substring)", () => {
    const result = filterTools(tools, "calendar");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("calendar_create");
  });

  test("matches by description", () => {
    const result = filterTools(tools, "vault");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("notes_search");
  });

  test("matches by category", () => {
    const result = filterTools(tools, "git");
    // "git" matches category "git" and also "git_commit" name
    expect(result.some((t) => t.name === "git_commit")).toBe(true);
  });

  test("search is case-insensitive", () => {
    const result = filterTools(tools, "CALENDAR");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("calendar_create");
  });

  test("returns empty array when nothing matches", () => {
    const result = filterTools(tools, "xyznonexistent");
    expect(result).toHaveLength(0);
  });

  test("query with spaces is trimmed before matching", () => {
    const result = filterTools(tools, "  notes  ");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("notes_search");
  });
});

// ─── groupTools ──────────────────────────────────────────────────────────────

describe("groupTools", () => {
  test("groups tools by category", () => {
    const tools = [
      makeTool({ name: "a", category: "tasks" }),
      makeTool({ name: "b", category: "calendar" }),
      makeTool({ name: "c", category: "tasks" }),
    ];
    const grouped = groupTools(tools);
    const taskGroup = grouped.find(([cat]) => cat === "tasks");
    expect(taskGroup?.[1]).toHaveLength(2);
  });

  test("groups are sorted by CATEGORY_ORDER", () => {
    const tools = [
      makeTool({ name: "a", category: "notes" }),
      makeTool({ name: "b", category: "calendar" }),
      makeTool({ name: "c", category: "tasks" }),
    ];
    const grouped = groupTools(tools);
    const categories = grouped.map(([cat]) => cat);
    expect(categories).toEqual(["calendar", "tasks", "notes"]);
  });

  test("tools with no category fall back to 'other'", () => {
    const tools = [
      makeTool({ name: "x", category: "" }),
    ];
    const grouped = groupTools(tools);
    expect(grouped[0][0]).toBe("other");
  });

  test("empty tools array returns empty groups", () => {
    expect(groupTools([])).toHaveLength(0);
  });
});

// ─── toggleTool ──────────────────────────────────────────────────────────────

describe("toggleTool", () => {
  test("disabling a tool adds it to disabledList", () => {
    const tools = [
      makeTool({ name: "tool_a", disabled: false }),
      makeTool({ name: "tool_b", disabled: false }),
    ];
    const { disabledList } = toggleTool(tools, "tool_a", true);
    expect(disabledList).toContain("tool_a");
    expect(disabledList).not.toContain("tool_b");
  });

  test("enabling a tool removes it from disabledList", () => {
    const tools = [
      makeTool({ name: "tool_a", disabled: true }),
      makeTool({ name: "tool_b", disabled: true }),
    ];
    const { disabledList } = toggleTool(tools, "tool_a", false);
    expect(disabledList).not.toContain("tool_a");
    expect(disabledList).toContain("tool_b");
  });

  test("does not mutate original array", () => {
    const tools = [makeTool({ name: "tool_a", disabled: false })];
    const { updated } = toggleTool(tools, "tool_a", true);
    expect(tools[0].disabled).toBe(false); // original unchanged
    expect(updated[0].disabled).toBe(true); // new array updated
  });

  test("only the targeted tool is changed", () => {
    const tools = [
      makeTool({ name: "tool_a", disabled: false }),
      makeTool({ name: "tool_b", disabled: false }),
      makeTool({ name: "tool_c", disabled: false }),
    ];
    const { updated } = toggleTool(tools, "tool_b", true);
    expect(updated[0].disabled).toBe(false);
    expect(updated[1].disabled).toBe(true);
    expect(updated[2].disabled).toBe(false);
  });
});

// ─── setAllTools ──────────────────────────────────────────────────────────────

describe("setAllTools", () => {
  const tools = [
    makeTool({ name: "a", disabled: false }),
    makeTool({ name: "b", disabled: true }),
    makeTool({ name: "c", disabled: false }),
  ];

  test("disabling all returns all names in disabledList", () => {
    const { disabledList } = setAllTools(tools, true);
    expect(disabledList).toEqual(["a", "b", "c"]);
  });

  test("enabling all returns empty disabledList", () => {
    const { disabledList } = setAllTools(tools, false);
    expect(disabledList).toEqual([]);
  });

  test("all tools have correct disabled flag after setAll(true)", () => {
    const { updated } = setAllTools(tools, true);
    expect(updated.every((t) => t.disabled)).toBe(true);
  });

  test("all tools have correct disabled flag after setAll(false)", () => {
    const { updated } = setAllTools(tools, false);
    expect(updated.every((t) => !t.disabled)).toBe(true);
  });

  test("does not mutate original array", () => {
    setAllTools(tools, true);
    expect(tools[0].disabled).toBe(false); // original unchanged
  });
});
