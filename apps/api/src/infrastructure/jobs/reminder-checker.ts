import type { ReminderService } from "../../application/reminder/reminder.service";
import type { EventRepository } from "../../domain/event/event.repository";
import type { ReminderEmitter } from "../../domain/reminder/reminder-emitter";

export function startReminderChecker(
  reminderService: ReminderService,
  eventRepo: EventRepository,
  emitter: ReminderEmitter,
  intervalMs = 30_000,
) {
  // Track emitted reminder IDs to avoid duplicate notifications
  const emittedIds = new Set<string>();

  const timer = setInterval(async () => {
    try {
      const pending = await reminderService.getPending();
      let emittedCount = 0;

      for (const reminder of pending) {
        if (emittedIds.has(reminder.id)) continue;

        const event = await eventRepo.findById(reminder.eventId);
        if (!event) continue;

        emitter.emit({
          ...reminder,
          eventTitle: event.title,
          eventStartAt: event.startAt,
        });

        emittedIds.add(reminder.id);
        emittedCount++;
      }

      if (emittedCount > 0) {
        console.log(`[reminder-checker] Emitted ${emittedCount} new reminder(s)`);
      }

      // Cleanup: remove IDs that are no longer pending (acked or deleted)
      const pendingIds = new Set(pending.map((r) => r.id));
      for (const id of emittedIds) {
        if (!pendingIds.has(id)) emittedIds.delete(id);
      }
    } catch (err) {
      console.error("[reminder-checker] Error:", err);
    }
  }, intervalMs);

  console.log(`[reminder-checker] Started (interval: ${intervalMs}ms)`);
  return timer;
}
