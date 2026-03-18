import type { AlarmRepository } from "../../domain/alarm/alarm.repository";
import type { Alarm, CreateAlarmInput, UpdateAlarmInput } from "../../domain/alarm/alarm.entity";

export class AlarmService {
  constructor(private alarmRepo: AlarmRepository) {}

  async getAll(): Promise<Alarm[]> {
    return this.alarmRepo.findAll();
  }

  async getById(id: string): Promise<Alarm | null> {
    return this.alarmRepo.findById(id);
  }

  async getEnabled(): Promise<Alarm[]> {
    return this.alarmRepo.findEnabled();
  }

  async create(input: CreateAlarmInput): Promise<Alarm> {
    return this.alarmRepo.create(input);
  }

  async update(id: string, input: UpdateAlarmInput): Promise<Alarm | null> {
    return this.alarmRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.alarmRepo.delete(id);
  }

  async markFired(id: string): Promise<void> {
    await this.alarmRepo.markFired(id);

    // For "once" alarms, disable after firing
    const alarm = await this.alarmRepo.findById(id);
    if (alarm && alarm.repeatPattern === "once") {
      await this.alarmRepo.update(id, { enabled: false });
    }
  }
}
