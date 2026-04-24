import type { FluxItem, FluxStatus, FluxEntityType, SetFluxInput, FluxFindOptions } from "./flux.entity";

export interface FluxRepository {
  findAll(entityType?: FluxEntityType): Promise<FluxItem[]>;
  findAllPaginated(options?: FluxFindOptions): Promise<{ data: FluxItem[]; total: number }>;
  findByStatus(status: FluxStatus, entityType?: FluxEntityType): Promise<FluxItem[]>;
  findByStatusPaginated(status: FluxStatus, entityType?: FluxEntityType, limit?: number, offset?: number): Promise<{ data: FluxItem[]; total: number }>;
  findByEntity(entityType: FluxEntityType, entityId: string): Promise<FluxItem | null>;
  upsert(input: SetFluxInput): Promise<FluxItem>;
  bulkUpsert(inputs: SetFluxInput[]): Promise<void>;
  deleteByEntity(entityType: FluxEntityType, entityId: string): Promise<void>;
  deleteAll(): Promise<void>;
  countByStatus(entityType?: FluxEntityType): Promise<Record<string, number>>;
  countByTypeAndStatus(): Promise<Record<string, Record<string, number>>>;
  countByDateRange(from: Date, to: Date): Promise<number>;
}
