import type { CalendarRepository } from "../../domain/calendar/calendar.repository";
import type { Calendar, CreateCalendarInput, UpdateCalendarInput } from "../../domain/calendar/calendar.entity";

export class CalendarService {
  constructor(private calendarRepo: CalendarRepository) {}

  async getAll(): Promise<Calendar[]> {
    return this.calendarRepo.findAll();
  }

  async getById(id: string): Promise<Calendar | null> {
    return this.calendarRepo.findById(id);
  }

  async create(input: CreateCalendarInput): Promise<Calendar> {
    return this.calendarRepo.create(input);
  }

  async update(id: string, input: UpdateCalendarInput): Promise<Calendar | null> {
    return this.calendarRepo.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.calendarRepo.delete(id);
  }
}
