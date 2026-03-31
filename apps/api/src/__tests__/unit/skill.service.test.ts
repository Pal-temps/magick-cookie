import { describe, it, expect, beforeEach } from "bun:test";
import { SkillService } from "../../application/skills/skill.service";
import { VaultService } from "../../infrastructure/vault/vault.service";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("SkillService", () => {
  let vault: VaultService;
  let skills: SkillService;
  let tmpVault: string;

  beforeEach(() => {
    // Create a temporary vault directory
    tmpVault = join(tmpdir(), `test-vault-${Date.now()}`);
    mkdirSync(join(tmpVault, "_ide", "skills"), { recursive: true });
    mkdirSync(join(tmpVault, "_ide", "hooks"), { recursive: true });
    mkdirSync(join(tmpVault, "_ide", "prompts"), { recursive: true });
    mkdirSync(join(tmpVault, "_projects", "test-app", "skills"), { recursive: true });

    vault = new VaultService();
    vault.setVaultPath(tmpVault);
    skills = new SkillService(vault);
  });

  it("listSkills returns empty when no skill files", () => {
    const result = skills.listSkills();
    expect(result).toEqual([]);
  });

  it("listSkills parses markdown with frontmatter", () => {
    const skillContent = `---
name: deploy-nextjs
description: Deploy a Next.js app
trigger: manual
tools_required: [dns_create_record, ssh_exec]
---

## Instructions

1. Create DNS record
2. Deploy the app
`;
    writeFileSync(join(tmpVault, "_ide", "skills", "deploy-nextjs.md"), skillContent);

    const result = skills.listSkills();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("deploy-nextjs");
    expect(result[0].description).toBe("Deploy a Next.js app");
    expect(result[0].trigger).toBe("manual");
    expect(result[0].toolsRequired).toEqual(["dns_create_record", "ssh_exec"]);
    expect(result[0].instructions).toContain("Create DNS record");
  });

  it("listHooks reads from _ide/hooks/", () => {
    writeFileSync(join(tmpVault, "_ide", "hooks", "pre-deploy.md"), `---
name: pre-deploy
description: Run before deploy
trigger: auto
---

Check git status before deploying.
`);

    const hooks = skills.listHooks();
    expect(hooks.length).toBe(1);
    expect(hooks[0].name).toBe("pre-deploy");
    expect(hooks[0].trigger).toBe("auto");
  });

  it("listPrompts reads from _ide/prompts/", () => {
    writeFileSync(join(tmpVault, "_ide", "prompts", "code-review.md"), `---
name: code-review
description: Review code quality
---

Review the following code for bugs and improvements.
`);

    const prompts = skills.listPrompts();
    expect(prompts.length).toBe(1);
    expect(prompts[0].name).toBe("code-review");
  });

  it("getSkill finds skill by name", () => {
    writeFileSync(join(tmpVault, "_ide", "skills", "backup.md"), `---
name: backup-db
description: Backup PostgreSQL
---

Run pg_dump.
`);

    const skill = skills.getSkill("backup-db");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("backup-db");
  });

  it("getSkill returns null for nonexistent", () => {
    expect(skills.getSkill("nonexistent")).toBeNull();
  });

  it("listProjectSkills reads project-specific skills", () => {
    writeFileSync(join(tmpVault, "_projects", "test-app", "skills", "lint.md"), `---
name: lint
description: Run linter
---

npm run lint
`);

    const projectSkills = skills.listProjectSkills("test-app");
    expect(projectSkills.length).toBe(1);
    expect(projectSkills[0].name).toBe("lint");
  });

  it("getProjectContext reads CLAUDE.md", () => {
    writeFileSync(join(tmpVault, "_projects", "test-app", "CLAUDE.md"), "# Test App\nUse TypeScript.");

    const ctx = skills.getProjectContext("test-app");
    expect(ctx).toContain("Test App");
    expect(ctx).toContain("TypeScript");
  });

  it("getProjectContext returns null when missing", () => {
    expect(skills.getProjectContext("nonexistent")).toBeNull();
  });

  it("buildPrompt replaces template variables", () => {
    const skill = {
      name: "deploy",
      description: "Deploy app",
      trigger: "manual" as const,
      toolsRequired: [],
      parameters: [{ name: "subdomain", type: "string", description: "Sub" }],
      instructions: "Deploy to {{subdomain}}.paltemps.fr on port {{port}}",
      filePath: "",
    };

    const prompt = skills.buildPrompt(skill, { subdomain: "app", port: "3000" });
    expect(prompt).toContain("app.paltemps.fr");
    expect(prompt).toContain("port 3000");
    expect(prompt).not.toContain("{{subdomain}}");
  });
});
