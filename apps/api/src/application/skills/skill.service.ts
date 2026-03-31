import type { VaultService } from "../../infrastructure/vault/vault.service";

// ─── Types ───

export interface SkillParameter {
  name: string;
  type: string;
  description: string;
  default?: string;
}

export interface Skill {
  name: string;
  description: string;
  trigger: "manual" | "auto";
  toolsRequired: string[];
  parameters: SkillParameter[];
  instructions: string;
  filePath: string;
}

// ─── Parse frontmatter from markdown ───

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((s) => s.trim());
    }
    meta[key] = value;
  }

  return { meta, body: match[2].trim() };
}

function parseParameters(meta: Record<string, unknown>): SkillParameter[] {
  const raw = meta.parameters;
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    name: p.name ?? "",
    type: p.type ?? "string",
    description: p.description ?? "",
    default: p.default,
  }));
}

function parseSkillContent(content: string, filePath: string): Skill | null {
  try {
    const { meta, body } = parseFrontmatter(content);
    return {
      name: (meta.name as string) ?? filePath.split(/[/\\]/).pop()?.replace(".md", "") ?? "unknown",
      description: (meta.description as string) ?? "",
      trigger: (meta.trigger as "manual" | "auto") ?? "manual",
      toolsRequired: Array.isArray(meta.tools_required) ? meta.tools_required : [],
      parameters: parseParameters(meta),
      instructions: body,
      filePath,
    };
  } catch {
    return null;
  }
}

// ─── Skill Service ───

export class SkillService {
  constructor(private vault: VaultService) {}

  private listFromDir(relDir: string): Skill[] {
    const files = this.vault.listDir(relDir, ".md");
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const content = this.vault.readText(`${relDir}/${f}`);
        if (!content) return null;
        return parseSkillContent(content, `${relDir}/${f}`);
      })
      .filter(Boolean) as Skill[];
  }

  listSkills(): Skill[] {
    return this.listFromDir("_ide/skills");
  }

  listHooks(): Skill[] {
    return this.listFromDir("_ide/hooks");
  }

  listPrompts(): Skill[] {
    return this.listFromDir("_ide/prompts");
  }

  listProjectSkills(projectName: string): Skill[] {
    return this.listFromDir(`_projects/${projectName}/skills`);
  }

  getSkill(name: string): Skill | null {
    const all = [...this.listSkills(), ...this.listHooks(), ...this.listPrompts()];
    return all.find((s) => s.name === name) ?? null;
  }

  getProjectContext(projectName: string): string | null {
    return this.vault.readText(`_projects/${projectName}/CLAUDE.md`);
  }

  buildPrompt(skill: Skill, params: Record<string, string>): string {
    let instructions = skill.instructions;
    for (const [key, value] of Object.entries(params)) {
      instructions = instructions.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return `## Skill: ${skill.name}\n\n${skill.description}\n\n### Instructions\n\n${instructions}`;
  }
}
