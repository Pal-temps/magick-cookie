import type { AgentTool } from "../tool-registry";
import type { AgentMemoryRepository } from "../../../domain/agent-memory/agent-memory.repository";
import type { AgentMemoryType } from "../../../domain/agent-memory/agent-memory.entity";

const VALID_TYPES: AgentMemoryType[] = ["fact", "context", "preference"];

export function createMemoryTools(memoryRepo: AgentMemoryRepository): AgentTool[] {
  return [
    {
      name: "save_memory",
      description: "Sauvegarde une information sur l'utilisateur. Types : fact (permanent, ex: 'dev backend'), context (expire 24h, ex: 'travaille sur auth'), preference (permanent, ex: 'prefere briefs courts')",
      parameters: {
        type: { type: "string", description: "Type : fact, context, ou preference", required: true },
        content: { type: "string", description: "Contenu de la memoire", required: true },
      },
      execute: async (params) => {
        const type = params.type as string;
        if (!VALID_TYPES.includes(type as AgentMemoryType)) {
          return { error: `Type invalide. Utilise : ${VALID_TYPES.join(", ")}` };
        }
        const memory = await memoryRepo.create({
          type: type as AgentMemoryType,
          content: params.content as string,
        });
        return { saved: true, id: memory.id, type: memory.type, expiresAt: memory.expiresAt };
      },
    },
    {
      name: "get_memories",
      description: "Recupere les memoires actives de l'utilisateur. Peut filtrer par type (fact, context, preference).",
      parameters: {
        type: { type: "string", description: "Filtrer par type (optionnel)", required: false },
      },
      execute: async (params) => {
        const type = params.type as string | undefined;
        if (type && !VALID_TYPES.includes(type as AgentMemoryType)) {
          return { error: `Type invalide. Utilise : ${VALID_TYPES.join(", ")}` };
        }
        const memories = await memoryRepo.findActive(type as AgentMemoryType | undefined);
        return {
          count: memories.length,
          memories: memories.map((m) => ({
            id: m.id,
            type: m.type,
            content: m.content,
            expiresAt: m.expiresAt,
          })),
        };
      },
    },
    {
      name: "delete_memory",
      description: "Supprime une memoire par son ID",
      parameters: {
        id: { type: "string", description: "ID de la memoire a supprimer", required: true },
      },
      execute: async (params) => {
        const deleted = await memoryRepo.delete(params.id as string);
        return { deleted };
      },
    },
  ];
}
