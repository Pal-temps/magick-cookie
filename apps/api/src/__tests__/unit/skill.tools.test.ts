import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createSkillTools } from "../../application/agent/tools/skill.tools";
import type { SkillService, Skill } from "../../application/skills/skill.service";
import type { AgentTool } from "../../application/agent/tool-registry";

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  name: "deploy",
  description: "Deploy the app",
  trigger: "manual",
  toolsRequired: ["ssh_exec", "caddy_add_site"],
  parameters: [{ name: "subdomain", type: "string", description: "Sub", default: "app" }],
  instructions: "Deploy {{subdomain}} now",
  filePath: "_ide/skills/deploy.md",
  ...overrides,
});

describe("skill.tools", () => {
  let svc: { [K in keyof SkillService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let getTool: AgentTool;
  let promptTool: AgentTool;

  beforeEach(() => {
    svc = {
      listSkills: mock(() => []),
      listHooks: mock(() => []),
      listPrompts: mock(() => []),
      listProjectSkills: mock(() => []),
      getSkill: mock(() => null),
      getProjectContext: mock(() => null),
      buildPrompt: mock(() => ""),
    } as unknown as { [K in keyof SkillService]: ReturnType<typeof mock> };

    tools = createSkillTools(svc as unknown as SkillService);
    listTool = tools.find((t) => t.name === "skill_list")!;
    getTool = tools.find((t) => t.name === "skill_get")!;
    promptTool = tools.find((t) => t.name === "skill_prompt")!;
  });

  it("registers 3 tools", () => {
    expect(tools.map((t) => t.name)).toEqual(["skill_list", "skill_get", "skill_prompt"]);
  });

  it("skill_list returns name/description/trigger/parameters and hook list", async () => {
    svc.listSkills.mockReturnValue([makeSkill({ name: "deploy" })]);
    svc.listHooks.mockReturnValue([makeSkill({ name: "post-receive", trigger: "auto", parameters: [] })]);

    const result = (await listTool.execute({})) as { skills: { name: string; parameters: string[] }[]; hooks: { name: string }[] };
    expect(result.skills).toEqual([{ name: "deploy", description: "Deploy the app", trigger: "manual", parameters: ["subdomain"] }]);
    expect(result.hooks[0].name).toBe("post-receive");
  });

  it("skill_get returns full skill details", async () => {
    svc.getSkill.mockReturnValue(makeSkill());
    const result = (await getTool.execute({ name: "deploy" })) as { instructions: string; tools_required: string[] };
    expect(result.tools_required).toEqual(["ssh_exec", "caddy_add_site"]);
    expect(result.instructions).toContain("{{subdomain}}");
    expect(svc.getSkill).toHaveBeenCalledWith("deploy");
  });

  it("skill_get returns an error payload when the skill is unknown", async () => {
    svc.getSkill.mockReturnValue(null);
    const result = (await getTool.execute({ name: "ghost" })) as { error?: string };
    expect(result.error).toContain("non trouve");
  });

  it("skill_prompt fills defaults and forwards user-supplied params", async () => {
    svc.getSkill.mockReturnValue(makeSkill());
    svc.buildPrompt.mockReturnValue("PROMPT");
    const result = (await promptTool.execute({ name: "deploy", params: '{"repo": "github.com/x/y"}' })) as { prompt: string };
    expect(result.prompt).toBe("PROMPT");
    const [, params] = svc.buildPrompt.mock.calls[0];
    // user-supplied repo should win, default subdomain="app" should fill in
    expect(params).toEqual({ repo: "github.com/x/y", subdomain: "app" });
  });

  it("skill_prompt swallows malformed JSON params (defaults still applied)", async () => {
    svc.getSkill.mockReturnValue(makeSkill());
    svc.buildPrompt.mockReturnValue("PROMPT");
    await promptTool.execute({ name: "deploy", params: "not-json" });
    const [, params] = svc.buildPrompt.mock.calls[0];
    expect(params).toEqual({ subdomain: "app" });
  });

  it("skill_prompt errors when skill is unknown", async () => {
    svc.getSkill.mockReturnValue(null);
    const result = (await promptTool.execute({ name: "ghost" })) as { error?: string };
    expect(result.error).toContain("non trouve");
    expect(svc.buildPrompt).not.toHaveBeenCalled();
  });
});
