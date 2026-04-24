import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { SkillService } from "../../skills/skill.service";

export function createSkillTools(skills: SkillService): AgentTool[] {
  return [
    defineTool({
      name: "skill_list",
      description: "Liste tous les skills et hooks disponibles dans le vault. Les skills sont des automatisations reutilisables (deploy, backup, etc.).",
      params: z.object({}),
      execute: async () => {
        const allSkills = skills.listSkills();
        const allHooks = skills.listHooks();
        return {
          skills: allSkills.map((s) => ({
            name: s.name,
            description: s.description,
            trigger: s.trigger,
            parameters: s.parameters.map((p) => p.name),
          })),
          hooks: allHooks.map((h) => ({
            name: h.name,
            description: h.description,
            trigger: h.trigger,
          })),
        };
      },
    }),
    defineTool({
      name: "skill_get",
      description: "Recupere les instructions detaillees d'un skill. Utile pour comprendre ce que le skill fait avant de l'executer.",
      params: z.object({
        name: z.string().min(1).max(200).describe("Nom du skill"),
      }),
      execute: async ({ name }) => {
        const skill = skills.getSkill(name);
        if (!skill) return { error: `Skill "${name}" non trouve` };
        return {
          name: skill.name,
          description: skill.description,
          parameters: skill.parameters,
          tools_required: skill.toolsRequired,
          instructions: skill.instructions,
        };
      },
    }),
    defineTool({
      name: "skill_prompt",
      description: "Genere le prompt systeme a partir d'un skill avec des parametres remplis. Retourne les instructions pretes a executer. Utilise ensuite les tools requis pour suivre les instructions.",
      params: z.object({
        name: z.string().min(1).max(200).describe("Nom du skill"),
        params: z.string().max(10_000).optional().describe("Parametres au format JSON (ex: {\"subdomain\": \"app\", \"repo\": \"https://...\"})"),
      }),
      execute: async ({ name, params: paramsJson }) => {
        const skill = skills.getSkill(name);
        if (!skill) return { error: `Skill "${name}" non trouve` };

        let params: Record<string, string> = {};
        try {
          if (paramsJson) params = JSON.parse(paramsJson);
        } catch { /* ignore parse errors */ }

        // Fill defaults
        for (const sp of skill.parameters) {
          if (!params[sp.name] && sp.default) params[sp.name] = sp.default;
        }

        const prompt = skills.buildPrompt(skill, params);
        return {
          skill: skill.name,
          tools_required: skill.toolsRequired,
          prompt,
        };
      },
    }),
  ];
}
