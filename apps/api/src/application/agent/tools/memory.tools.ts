import { z } from "zod";
import { defineTool, type AgentTool } from "../tool-registry";
import type { AgentMemoryRepository } from "../../../domain/agent-memory/agent-memory.repository";
import type { AgentMemoryType } from "../../../domain/agent-memory/agent-memory.entity";

const MEMORY_TYPES = ["fact", "context", "preference"] as const;

export function createMemoryTools(memoryRepo: AgentMemoryRepository): AgentTool[] {
  return [
    defineTool({
      name: "save_memory",
      description: "Sauvegarde une information sur l'utilisateur. Types : fact (permanent, ex: 'dev backend'), context (expire 24h, ex: 'travaille sur auth'), preference (permanent, ex: 'prefere briefs courts')",
      params: z.object({
        type: z.enum(MEMORY_TYPES).describe("Type : fact, context, ou preference"),
        content: z.string().min(1).max(2000).describe("Contenu de la memoire"),
      }),
      execute: async ({ type, content }) => {
        const memory = await memoryRepo.create({ type: type as AgentMemoryType, content });
        return { saved: true, id: memory.id, type: memory.type, expiresAt: memory.expiresAt };
      },
    }),
    defineTool({
      name: "get_memories",
      description: "Recupere les memoires actives de l'utilisateur. Peut filtrer par type (fact, context, preference).",
      params: z.object({
        type: z.enum(MEMORY_TYPES).optional().describe("Filtrer par type (optionnel)"),
      }),
      execute: async ({ type }) => {
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
    }),
    defineTool({
      name: "delete_memory",
      description: "Supprime une memoire par son ID",
      params: z.object({
        id: z.string().min(1).describe("ID de la memoire a supprimer"),
      }),
      execute: async ({ id }) => {
        const deleted = await memoryRepo.delete(id);
        return { deleted };
      },
    }),
  ];
}
