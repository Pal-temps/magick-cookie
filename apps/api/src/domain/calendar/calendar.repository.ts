import type { Calendar, CreateCalendarInput, UpdateCalendarInput } from "./calendar.entity";

export interface CalendarRepository {
  findAll(): Promise<Calendar[]>;
  findById(id: string): Promise<Calendar | null>;
  create(input: CreateCalendarInput): Promise<Calendar>;
  update(id: string, input: UpdateCalendarInput): Promise<Calendar | null>;
  delete(id: string): Promise<boolean>;
}
