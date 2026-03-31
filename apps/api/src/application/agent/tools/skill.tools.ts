import type { AgentTool } from "../tool-registry";
import type { SkillService } from "../../skills/skill.service";

export function createSkillTools(skills: SkillService): AgentTool[] {
  return [
    {
      name: "skill_list",
      description: "Liste tous les skills et hooks disponibles dans le vault. Les skills sont des automatisations reutilisables (deploy, backup, etc.).",
      parameters: {},
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
    },
    {
      name: "skill_get",
      description: "Recupere les instructions detaillees d'un skill. Utile pour comprendre ce que le skill fait avant de l'executer.",
      parameters: {
        name: { type: "string", description: "Nom du skill", required: true },
      },
      execute: async (params) => {
        const skill = skills.getSkill(params.name as string);
        if (!skill) return { error: `Skill "${params.name}" non trouve` };
        return {
          name: skill.name,
          description: skill.description,
          parameters: skill.parameters,
          tools_required: skill.toolsRequired,
          instructions: skill.instructions,
        };
      },
    },
    {
      name: "skill_prompt",
      description: "Genere le prompt systeme a partir d'un skill avec des parametres remplis. Retourne les instructions pretes a executer. Utilise ensuite les tools requis pour suivre les instructions.",
      parameters: {
        name: { type: "string", description: "Nom du skill", required: true },
        params: { type: "string", description: "Parametres au format JSON (ex: {\"subdomain\": \"app\", \"repo\": \"https://...\"})", required: false },
      },
      execute: async (p) => {
        const skill = skills.getSkill(p.name as string);
        if (!skill) return { error: `Skill "${p.name}" non trouve` };

        let params: Record<string, string> = {};
        try {
          if (p.params) params = JSON.parse(p.params as string);
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
    },
  ];
}
