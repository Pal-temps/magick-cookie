import { createSignal } from "solid-js";
import type { Calendar, CreateCalendarDTO, UpdateCalendarDTO } from "../../domain/models/Calendar";
import type { CalendarEvent, CreateEventDTO, UpdateEventDTO, Contact, CreateContactDTO, UpdateContactDTO } from "../../domain/models/CalendarEvent";
import type { ParsedEventData } from "../services/eventParser";
import { api } from "../../infrastructure/api/apiClient";

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

// --- Speech prefill ---
const [prefillData, setPrefillData] = createSignal<ParsedEventData | null>(null);

export function useCalendarStore() {
  // Calendar CRUD
  async function fetchCalendars() {
    const data = await api.get<Calendar[]>("/calendars");
    setCalendars(data);
    setActiveCalendarIds(new Set(data.map((c) => c.id)));
  }

  async function createCalendar(input: CreateCalendarDTO) {
    const cal = await api.post<Calendar>("/calendars", input);
    setCalendars((prev) => [...prev, cal]);
    setActiveCalendarIds((prev) => new Set([...prev, cal.id]));
    return cal;
  }

  async function updateCalendar(id: string, input: UpdateCalendarDTO) {
    const cal = await api.put<Calendar>(`/calendars/${id}`, input);
    setCalendars((prev) => prev.map((c) => (c.id === id ? cal : c)));
    return cal;
  }

  async function deleteCalendar(id: string) {
    await api.delete(`/calendars/${id}`);
    setCalendars((prev) => prev.filter((c) => c.id !== id));
    setActiveCalendarIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
    setEvents([...data, ...birthdayEvents]);
  }

  async function createEvent(calendarId: string, input: CreateEventDTO) {
    const event = await api.post<CalendarEvent>(`/calendars/${calendarId}/events`, input);
    setEvents((prev) => [...prev, event]);
    return event;
  }

  async function updateEvent(id: string, input: UpdateEventDTO) {
    const event = await api.put<CalendarEvent>(`/events/${id}`, input);
    setEvents((prev) => prev.map((e) => (e.id === id ? event : e)));
    return event;
  }

  async function deleteEvent(id: string) {
    await api.delete(`/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (selectedEvent()?.id === id) setSelectedEvent(null);
  }

  function toggleSourceFilter(source: "birthdays" | "connector" | "personal") {
    if (source === "birthdays") setShowBirthdays((v) => !v);
    else if (source === "connector") setShowConnectorEvents((v) => !v);
    else setShowPersonal((v) => !v);
  }

  function visibleEvents() {
    const active = activeCalendarIds();
    return events().filter((e) => {
      if (e._isBirthday) return showBirthdays();
      if (e.taskId) return showConnectorEvents();
      return showPersonal() && active.has(e.calendarId);
    });
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
    const contact = await api.post<Contact>("/contacts", dto);
    setContacts((prev) => [...prev, contact]);
    return contact;
  }

  async function updateContact(id: string, dto: UpdateContactDTO) {
    const contact = await api.put<Contact>(`/contacts/${id}`, dto);
    setContacts((prev) => prev.map((c) => (c.id === id ? contact : c)));
    return contact;
  }

  async function deleteContact(id: string) {
    await api.delete(`/contacts/${id}`);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function birthdayEventsForRange(from: Date, to: Date): CalendarEvent[] {
    const result: CalendarEvent[] = [];
    for (const c of contacts().filter(c => c.birthDate !== null)) {
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
    showBirthdays, showConnectorEvents, showPersonal, toggleSourceFilter,
    prefillData, setPrefillData,
    openCreateForm, openCreateFormWithData, openEditForm, closeForm,
    contacts, fetchContacts, createContact, updateContact, deleteContact, birthdayEventsForRange,
  };
}
