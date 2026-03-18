export type AgentMemoryType = "fact" | "context" | "preference";

export interface AgentMemory {
  id: string;
  type: AgentMemoryType;
  content: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface CreateAgentMemoryInput {
  type: AgentMemoryType;
  content: string;
  expiresAt?: Date;
}
