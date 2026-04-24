import { describe, it, expect } from "bun:test";

// ─── Pure functions extracted from workflowStore.ts (no Tauri/SolidJS deps) ───

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  model: string;
  permissionMode: string;
  preCommit: string[];
  postCommit: string[];
  instructions: string;
  path: string;
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, unknown> = {};
  let currentKey = "";
  let inArray = false;
  const arrayItems: string[] = [];

  for (const line of match[1].split("\n")) {
    const kvMatch = line.match(/^(\w[\w\s]*?):\s*(.*)$/);
    if (kvMatch && !line.startsWith("  -")) {
      if (inArray && currentKey) {
        meta[currentKey] = [...arrayItems];
        arrayItems.length = 0;
        inArray = false;
      }
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === "") {
        inArray = true;
      } else {
        meta[currentKey] = val;
      }
    } else if (line.match(/^\s+-\s+(.*)$/) && inArray) {
      arrayItems.push(line.replace(/^\s+-\s+/, ""));
    }
  }
  if (inArray && currentKey) {
    meta[currentKey] = [...arrayItems];
  }

  return { meta, body: match[2].trim() };
}

function toFrontmatter(template: WorkflowTemplate): string {
  const lines: string[] = ["---"];
  lines.push(`name: ${template.name}`);
  lines.push(`description: ${template.description}`);
  if (template.model) lines.push(`model: ${template.model}`);
  if (template.permissionMode) lines.push(`permissionMode: ${template.permissionMode}`);
  if (template.preCommit.length > 0) {
    lines.push("preCommit:");
    for (const cmd of template.preCommit) lines.push(`  - ${cmd}`);
  }
  if (template.postCommit.length > 0) {
    lines.push("postCommit:");
    for (const cmd of template.postCommit) lines.push(`  - ${cmd}`);
  }
  lines.push("---");
  lines.push("");
  lines.push(template.instructions);
  return lines.join("\n");
}

function parseTemplate(id: string, path: string, raw: string): WorkflowTemplate {
  const { meta, body } = parseFrontmatter(raw);
  return {
    id,
    name: (meta.name as string) || id,
    description: (meta.description as string) || "",
    model: (meta.model as string) || "",
    permissionMode: (meta.permissionMode as string) || "default",
    preCommit: Array.isArray(meta.preCommit) ? meta.preCommit as string[] : [],
    postCommit: Array.isArray(meta.postCommit) ? meta.postCommit as string[] : [],
    instructions: body,
    path,
  };
}

function generateWorkflowId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Tests ───

describe("parseFrontmatter", () => {
  it("parses simple key-value pairs", () => {
    const raw = `---
name: My Workflow
description: A test workflow
---
Instructions here`;
    const { meta, body } = parseFrontmatter(raw);
    expect(meta.name).toBe("My Workflow");
    expect(meta.description).toBe("A test workflow");
    expect(body).toBe("Instructions here");
  });

  it("parses array values", () => {
    const raw = `---
name: DDD
preCommit:
  - bun test
  - tsc --noEmit
---
Body`;
    const { meta } = parseFrontmatter(raw);
    expect(meta.name).toBe("DDD");
    expect(meta.preCommit).toEqual(["bun test", "tsc --noEmit"]);
  });

  it("returns raw body when no frontmatter", () => {
    const raw = "Just plain text, no frontmatter";
    const { meta, body } = parseFrontmatter(raw);
    expect(meta).toEqual({});
    expect(body).toBe(raw);
  });

  it("handles empty frontmatter (no match — requires content between ---)", () => {
    // The regex requires at least a newline between --- markers
    // An empty frontmatter block without content between delimiters falls through to body
    const raw = `---\n\n---\nBody text`;
    const { meta, body } = parseFrontmatter(raw);
    expect(Object.keys(meta)).toHaveLength(0);
    expect(body).toBe("Body text");
  });

  it("handles multiple array fields", () => {
    const raw = `---
preCommit:
  - bun test
postCommit:
  - git push
  - notify
---`;
    const { meta } = parseFrontmatter(raw);
    expect(meta.preCommit).toEqual(["bun test"]);
    expect(meta.postCommit).toEqual(["git push", "notify"]);
  });

  it("handles mixed scalar and array fields", () => {
    const raw = `---
name: Test
model: claude-opus-4-6
preCommit:
  - lint
description: A workflow
---
Body`;
    const { meta } = parseFrontmatter(raw);
    expect(meta.name).toBe("Test");
    expect(meta.model).toBe("claude-opus-4-6");
    expect(meta.preCommit).toEqual(["lint"]);
    expect(meta.description).toBe("A workflow");
  });

  it("handles empty body after frontmatter", () => {
    const raw = `---
name: Test
---`;
    const { meta, body } = parseFrontmatter(raw);
    expect(meta.name).toBe("Test");
    expect(body).toBe("");
  });
});

describe("toFrontmatter", () => {
  it("serializes a template with all fields", () => {
    const template: WorkflowTemplate = {
      id: "test", name: "Test", description: "A test",
      model: "opus", permissionMode: "auto",
      preCommit: ["bun test"], postCommit: ["git push"],
      instructions: "Do things", path: "_workflows/test.md",
    };
    const result = toFrontmatter(template);
    expect(result).toContain("name: Test");
    expect(result).toContain("model: opus");
    expect(result).toContain("  - bun test");
    expect(result).toContain("  - git push");
    expect(result).toContain("Do things");
  });

  it("omits empty arrays", () => {
    const template: WorkflowTemplate = {
      id: "test", name: "Test", description: "",
      model: "", permissionMode: "default",
      preCommit: [], postCommit: [],
      instructions: "Body", path: "",
    };
    const result = toFrontmatter(template);
    expect(result).not.toContain("preCommit:");
    expect(result).not.toContain("postCommit:");
  });

  it("omits empty model", () => {
    const template: WorkflowTemplate = {
      id: "t", name: "T", description: "",
      model: "", permissionMode: "default",
      preCommit: [], postCommit: [],
      instructions: "", path: "",
    };
    const result = toFrontmatter(template);
    expect(result).not.toContain("model:");
  });
});

describe("toFrontmatter / parseFrontmatter round-trip", () => {
  it("round-trips a full template", () => {
    const original: WorkflowTemplate = {
      id: "ddd", name: "DDD Strict", description: "Full DDD",
      model: "opus", permissionMode: "auto",
      preCommit: ["bun test", "tsc --noEmit"], postCommit: ["deploy"],
      instructions: "## DDD\n\nFollow the rules.", path: "_workflows/ddd.md",
    };
    const serialized = toFrontmatter(original);
    const parsed = parseTemplate("ddd", "_workflows/ddd.md", serialized);

    expect(parsed.name).toBe(original.name);
    expect(parsed.description).toBe(original.description);
    expect(parsed.model).toBe(original.model);
    expect(parsed.preCommit).toEqual(original.preCommit);
    expect(parsed.postCommit).toEqual(original.postCommit);
    expect(parsed.instructions).toBe(original.instructions);
  });
});

describe("parseTemplate", () => {
  it("uses defaults when fields are missing", () => {
    const raw = `---\nplaceholder: x\n---\nBody`;
    const result = parseTemplate("my-wf", "_workflows/my-wf.md", raw);
    expect(result.id).toBe("my-wf");
    expect(result.name).toBe("my-wf"); // fallback to id
    expect(result.description).toBe("");
    expect(result.model).toBe("");
    expect(result.permissionMode).toBe("default");
    expect(result.preCommit).toEqual([]);
    expect(result.postCommit).toEqual([]);
    expect(result.instructions).toBe("Body");
  });

  it("parses a complete template", () => {
    const raw = `---
name: TDD
description: Test first
model: sonnet
permissionMode: auto
preCommit:
  - bun test
---
Write tests first.`;
    const result = parseTemplate("tdd", "_workflows/tdd.md", raw);
    expect(result.name).toBe("TDD");
    expect(result.description).toBe("Test first");
    expect(result.model).toBe("sonnet");
    expect(result.permissionMode).toBe("auto");
    expect(result.preCommit).toEqual(["bun test"]);
    expect(result.instructions).toBe("Write tests first.");
  });
});

describe("generateWorkflowId", () => {
  it("converts name to kebab-case", () => {
    expect(generateWorkflowId("My Workflow")).toBe("my-workflow");
  });

  it("removes special characters", () => {
    expect(generateWorkflowId("DDD (Strict)!")).toBe("ddd-strict");
  });

  it("strips leading and trailing dashes", () => {
    expect(generateWorkflowId("--hello--")).toBe("hello");
  });

  it("handles single word", () => {
    expect(generateWorkflowId("simple")).toBe("simple");
  });

  it("collapses multiple separators", () => {
    expect(generateWorkflowId("a   b   c")).toBe("a-b-c");
  });
});
