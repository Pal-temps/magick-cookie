import type { CalDavAccount, CreateCalDavAccountInput, UpdateCalDavAccountInput } from "./caldav.entity";

export interface CalDavAccountRepository {
  findAll(): Promise<CalDavAccount[]>;
  findById(id: string): Promise<CalDavAccount | null>;
  findActive(): Promise<CalDavAccount[]>;
  create(input: CreateCalDavAccountInput): Promise<CalDavAccount>;
  update(id: string, input: UpdateCalDavAccountInput): Promise<CalDavAccount | null>;
  updateLastSyncedAt(id: string, date: Date): Promise<void>;
  delete(id: string): Promise<boolean>;
  getPassword(id: string): Promise<string | null>;
}
