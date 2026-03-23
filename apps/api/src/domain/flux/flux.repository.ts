import type { FluxItem, FluxStatus, FluxEntityType, SetFluxInput } from "./flux.entity";

export interface FluxRepository {
  findAll(entityType?: FluxEntityType): Promise<FluxItem[]>;
  findByStatus(status: FluxStatus, entityType?: FluxEntityType): Promise<FluxItem[]>;
  findByEntity(entityType: FluxEntityType, entityId: string): Promise<FluxItem | null>;
  upsert(input: SetFluxInput): Promise<FluxItem>;
  bulkUpsert(inputs: SetFluxInput[]): Promise<void>;
  deleteByEntity(entityType: FluxEntityType, entityId: string): Promise<void>;
  deleteAll(): Promise<void>;
  countByStatus(entityType?: FluxEntityType): Promise<Record<string, number>>;
  countByDateRange(from: Date, to: Date): Promise<number>;
}
