import type { AgentMemory, AgentMemoryType, CreateAgentMemoryInput } from "./agent-memory.entity";

export interface AgentMemoryRepository {
  findAll(type?: AgentMemoryType): Promise<AgentMemory[]>;
  findActive(type?: AgentMemoryType): Promise<AgentMemory[]>;
  create(input: CreateAgentMemoryInput): Promise<AgentMemory>;
  delete(id: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}
