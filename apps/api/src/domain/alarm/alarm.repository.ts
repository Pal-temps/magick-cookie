import type { Alarm, CreateAlarmInput, UpdateAlarmInput } from "./alarm.entity";

export interface AlarmRepository {
  findAll(): Promise<Alarm[]>;
  findById(id: string): Promise<Alarm | null>;
  findEnabled(): Promise<Alarm[]>;
  create(input: CreateAlarmInput): Promise<Alarm>;
  update(id: string, input: UpdateAlarmInput): Promise<Alarm | null>;
  delete(id: string): Promise<boolean>;
  markFired(id: string): Promise<void>;
}
