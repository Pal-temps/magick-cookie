import type { ReminderEmitter, ReminderWithEvent } from "../../domain/reminder/reminder-emitter";

export class InMemoryReminderEmitter implements ReminderEmitter {
  private listeners = new Set<(reminder: ReminderWithEvent) => void>();

  subscribe(listener: (reminder: ReminderWithEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(reminder: ReminderWithEvent): void {
    for (const listener of this.listeners) {
      listener(reminder);
    }
  }
}
