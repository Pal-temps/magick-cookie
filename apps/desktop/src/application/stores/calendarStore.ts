import { createSignal } from "solid-js";
import type { Calendar, CreateCalendarDTO, UpdateCalendarDTO } from "../../domain/models/Calendar";
import type { CalendarEvent, CreateEventDTO, UpdateEventDTO, Contact, CreateContactDTO, UpdateContactDTO } from "../../domain/models/CalendarEvent";
import type { ParsedEventData } from "../services/eventParser";
import { api } from "../../infrastructure/api/apiClient";
import type { Alarm } from "./alarmStore";

// --- Calendars ---
const [calendars, setCalendars] = createSignal<Calendar[]>([]);
const [activeCalendarIds, setActiveCalendarIds] = createSignal<Set<string>>(new Set());

// --- Events ---
const [events, setEvents] = createSignal<CalendarEvent[]>([]);
const [selectedEvent, setSelectedEvent] = createSignal<CalendarEvent | null>(null);

// --- UI state ---
const [isEventFormOpen, setEventFormOpen] = createSignal(false);
const [editingEvent, setEditingEvent] = createSignal<CalendarEvent | null>(null);

// --- Contacts ---
const [contacts, setContacts] = createSignal<Contact[]>([]);

// --- Source filters ---
const [showBirthdays, setShowBirthdays] = createSignal(true);
const [showConnectorEvents, setShowConnectorEvents] = createSignal(true);
const [showPersonal, setShowPersonal] = createSignal(true);
const [showAlarms, setShowAlarms] = createSignal(false);

// --- Speech prefill ---
const [prefillData, setPrefillData] = createSignal<ParsedEventData | null>(null);

// --- AI generation ---
const [generatedEvents, setGeneratedEvents] = createSignal<CreateEventDTO[]>([]);
const [isGenerating, setIsGenerating] = createSignal(false);
const [showAiGenerator, setShowAiGenerator] = createSignal(false);

// --- External alarm ref ---
let alarmGetter: (() => Alarm[]) | null = null;

export function useCalendarStore() {
  // Calendar CRUD
  async function fetchCalendars() {
    let data = await api.get<Calendar[]>("/calendars");
    if (data.length === 0) {
      const defaultCal = await api.post<Calendar>("/calendars", {
        name: "Personnel",
        color: "#6c5ce7",
        isDefault: true,
      });
      if (defaultCal) data = [defaultCal];
    }
    setCalendars(data);
    setActiveCalendarIds(new Set(data.map((c) => c.id)));
  }

  async function createCalendar(input: CreateCalendarDTO) {
    try {
      const cal = await api.post<Calendar>("/calendars", input);
      if (cal) {
        setCalendars((prev) => [...prev, cal]);
        setActiveCalendarIds((prev) => new Set([...prev, cal.id]));
      }
      return cal;
    } catch (err) {
      console.error("[calendar] Failed to create calendar:", err);
      throw err;
    }
  }

  async function updateCalendar(id: string, input: UpdateCalendarDTO) {
    try {
      const cal = await api.put<Calendar>(`/calendars/${id}`, input);
      if (cal) {
        setCalendars((prev) => prev.map((c) => (c.id === id ? cal : c)));
      }
      return cal;
    } catch (err) {
      console.error("[calendar] Failed to update calendar:", err);
      throw err;
    }
  }

  async function deleteCalendar(id: string) {
    // Optimistic update
    setCalendars((prev) => prev.filter((c) => c.id !== id));
    setActiveCalendarIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await api.delete(`/calendars/${id}`);
    } catch (err) {
      console.error("[calendar] Failed to delete calendar:", err);
    }
  }

  function toggleCalendarVisibility(id: string) {
    setActiveCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Event CRUD
  async function fetchEvents(from: Date, to: Date) {
    const params = `?from=${from.toISOString()}&to=${to.toISOString()}`;
    const data = await api.get<CalendarEvent[]>(`/events${params}`);
    const birthdayEvents = birthdayEventsForRange(from, to);
    const alarmEvents = alarmEventsForRange(from, to);
    setEvents([...data, ...birthdayEvents, ...alarmEvents]);
  }

  async function createEvent(calendarId: string, input: CreateEventDTO) {
    try {
      const event = await api.post<CalendarEvent>(`/calendars/${calendarId}/events`, input);
      if (event) {
        setEvents((prev) => [...prev, event]);
      }
      return event;
    } catch (err) {
      console.error("[calendar] Failed to create event:", err);
      throw err;
    }
  }

  async function updateEvent(id: string, input: UpdateEventDTO) {
    try {
      const event = await api.put<CalendarEvent>(`/events/${id}`, input);
      if (event) {
        setEvents((prev) => prev.map((e) => (e.id === id ? event : e)));
      }
      return event;
    } catch (err) {
      console.error("[calendar] Failed to update event:", err);
      throw err;
    }
  }

  async function deleteEvent(id: string) {
    // Optimistic update
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (selectedEvent()?.id === id) setSelectedEvent(null);
    try {
      await api.delete(`/events/${id}`);
    } catch (err) {
      console.error("[calendar] Failed to delete event:", err);
    }
  }

  function toggleSourceFilter(source: "birthdays" | "connector" | "personal" | "alarms") {
    if (source === "birthdays") setShowBirthdays((v) => !v);
    else if (source === "connector") setShowConnectorEvents((v) => !v);
    else if (source === "alarms") setShowAlarms((v) => !v);
    else setShowPersonal((v) => !v);
  }

  function visibleEvents() {
    const active = activeCalendarIds();
    const baseEvents = events().filter((e) => {
      if (e._isBirthday) return showBirthdays();
      if (e._isAlarm) return showAlarms();
      if (e.taskId) return showConnectorEvents();
      return showPersonal() && active.has(e.calendarId);
    });
    if (!showAlarms() || !alarmGetter) return baseEvents;
    return baseEvents;
  }

  function openCreateForm() {
    setEditingEvent(null);
    setEventFormOpen(true);
  }

  function openCreateFormWithData(data: ParsedEventData) {
    setPrefillData(data);
    setEditingEvent(null);
    setEventFormOpen(true);
  }

  function openEditForm(event: CalendarEvent) {
    setEditingEvent(event);
    setEventFormOpen(true);
  }

  function closeForm() {
    setEditingEvent(null);
    setEventFormOpen(false);
  }

  // Contact CRUD
  async function fetchContacts() {
    const data = await api.get<Contact[]>("/contacts");
    setContacts(data);
  }

  async function createContact(dto: CreateContactDTO) {
    try {
      const contact = await api.post<Contact>("/contacts", dto);
      if (contact) {
        setContacts((prev) => [...prev, contact]);
      }
      return contact;
    } catch (err) {
      console.error("[calendar] Failed to create contact:", err);
      throw err;
    }
  }

  async function updateContact(id: string, dto: UpdateContactDTO) {
    try {
      const contact = await api.put<Contact>(`/contacts/${id}`, dto);
      if (contact) {
        setContacts((prev) => prev.map((c) => (c.id === id ? contact : c)));
      }
      return contact;
    } catch (err) {
      console.error("[calendar] Failed to update contact:", err);
      throw err;
    }
  }

  async function deleteContact(id: string) {
    // Optimistic update
    setContacts((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.delete(`/contacts/${id}`);
    } catch (err) {
      console.error("[calendar] Failed to delete contact:", err);
    }
  }

  // --- Alarm → CalendarEvent adapter ---
  function alarmEventsForRange(from: Date, to: Date): CalendarEvent[] {
    if (!alarmGetter) return [];
    const result: CalendarEvent[] = [];
    const alarmList = alarmGetter();

    for (const alarm of alarmList) {
      if (!alarm.enabled) continue;

      const current = new Date(from);
      while (current <= to) {
        const dayOfWeek = current.getDay();
        let shouldShow = false;

        switch (alarm.repeatPattern) {
          case "daily":
            shouldShow = true;
            break;
          case "weekdays":
            shouldShow = dayOfWeek >= 1 && dayOfWeek <= 5;
            break;
          case "weekends":
            shouldShow = dayOfWeek === 0 || dayOfWeek === 6;
            break;
          case "custom":
            shouldShow = alarm.repeatDays?.includes(dayOfWeek) ?? false;
            break;
          case "once": {
            const todayStr = new Date().toISOString().slice(0, 10);
            const currentStr = current.toISOString().slice(0, 10);
            shouldShow = currentStr === todayStr && !alarm.lastFiredAt;
            break;
          }
        }

        if (shouldShow) {
          const [hours, minutes] = alarm.time.split(":").map(Number);
          const startAt = new Date(current);
          startAt.setHours(hours, minutes, 0, 0);
          const endAt = new Date(startAt);
          endAt.setMinutes(endAt.getMinutes() + 5);

          result.push({
            id: `alarm-${alarm.id}-${current.toISOString().slice(0, 10)}`,
            calendarId: "alarms",
            title: `Alarme: ${alarm.label}`,
            description: null,
            location: null,
            latitude: null,
            longitude: null,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            isAllDay: false,
            recurrenceRule: null,
            taskId: null,
            createdAt: alarm.createdAt,
            updatedAt: alarm.updatedAt,
            _isAlarm: true,
          });
        }

        current.setDate(current.getDate() + 1);
      }
    }
    return result;
  }

  function setAlarmGetter(getter: () => Alarm[]) {
    alarmGetter = getter;
  }

  // --- Open form at specific date ---
  function openCreateFormAtDate(date: Date, hour?: number) {
    const startAt = new Date(date);
    if (hour !== undefined) {
      startAt.setHours(hour, 0, 0, 0);
    }
    const endAt = new Date(startAt.getTime() + 3600000);
    setPrefillData({
      title: "",
      startAt,
      endAt,
      location: null,
      isAllDay: hour === undefined,
    });
    setEditingEvent(null);
    setEventFormOpen(true);
  }

  // --- AI Event Generation ---
  async function generateEvents(prompt: string, date: string) {
    const { trackAiActivity } = await import("./aiActivityStore");
    setIsGenerating(true);
    try {
      const data = await trackAiActivity("Generation evenements IA", () =>
        api.post<{ events: CreateEventDTO[] }>("/llm/generate-events", { prompt, date })
      );
      setGeneratedEvents(data.events);
      return data.events;
    } catch (e) {
      console.error("Failed to generate events:", e);
      setGeneratedEvents([]);
      return [];
    } finally {
      setIsGenerating(false);
    }
  }

  async function createBulkEvents(calendarId: string, evts: CreateEventDTO[]) {
    const created: CalendarEvent[] = [];
    for (const input of evts) {
      try {
        const event = await api.post<CalendarEvent>(`/calendars/${calendarId}/events`, input);
        if (event) created.push(event);
      } catch (err) {
        console.error("[calendar] Failed to create bulk event:", err);
      }
    }
    if (created.length > 0) {
      setEvents((prev) => [...prev, ...created]);
    }
    setGeneratedEvents([]);
    return created;
  }

  function birthdayEventsForRange(from: Date, to: Date): CalendarEvent[] {
    const result: CalendarEvent[] = [];
    for (const c of contacts().filter(c => c.birthDate !== null && c.name)) {
      const birthDate = new Date(c.birthDate!);
      const birthMonth = birthDate.getMonth();
      const birthDay = birthDate.getDate();

      for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
        const eventDate = new Date(year, birthMonth, birthDay);
        if (eventDate < from || eventDate > to) continue;

        const age = year - birthDate.getFullYear();
        const ageLabel = age > 0 ? ` (${age} ans)` : "";
        const startAt = new Date(year, birthMonth, birthDay, 0, 0, 0);
        const endAt = new Date(year, birthMonth, birthDay, 23, 59, 59);

        result.push({
          id: `birthday-${c.id}-${year}`,
          calendarId: "birthdays",
          title: `Anniversaire de ${c.name}${ageLabel}`,
          description: c.notes,
          location: null,
          latitude: null,
          longitude: null,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          isAllDay: true,
          recurrenceRule: null,
          taskId: null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          _isBirthday: true,
        });
      }
    }
    return result;
  }

  return {
    calendars, activeCalendarIds,
    events, selectedEvent, setSelectedEvent,
    isEventFormOpen, editingEvent,
    fetchCalendars, createCalendar, updateCalendar, deleteCalendar,
    toggleCalendarVisibility,
    fetchEvents, createEvent, updateEvent, deleteEvent,
    visibleEvents,
    showBirthdays, showConnectorEvents, showPersonal, showAlarms, toggleSourceFilter,
    prefillData, setPrefillData,
    openCreateForm, openCreateFormWithData, openCreateFormAtDate, openEditForm, closeForm,
    contacts, fetchContacts, createContact, updateContact, deleteContact, birthdayEventsForRange,
    setAlarmGetter,
    generateEvents, createBulkEvents, generatedEvents, setGeneratedEvents, isGenerating, showAiGenerator, setShowAiGenerator,
  };
}
