import type { Locale } from "./types";
import { getLocale } from "./locale";

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 0=Mon ... 6=Sun (ISO week) */
export function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function toISODate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

export function parseDateTime(iso: string): { date: string; time: string } {
  const [date, time] = iso.split("T");
  return { date: date || "", time: time || "00:00" };
}

export function todayISO(): string {
  return toISODate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
}

export function formatDate(iso: string, locale: Locale = "fr"): string {
  if (!iso) return "";
  const { year, month, day } = parseDate(iso);
  const l = getLocale(locale);
  return `${day} ${l.monthsShort[month]} ${year}`;
}

export function formatTime(time: string): string {
  return time || "";
}

export function formatDateTime(iso: string, locale: Locale = "fr"): string {
  if (!iso) return "";
  const { date, time } = parseDateTime(iso);
  const l = getLocale(locale);
  return `${formatDate(date, locale)} ${l.at} ${time}`;
}

export function generateTimeSlots(step: number = 15, min?: string, max?: string): string[] {
  const slots: string[] = [];
  const minMinutes = min ? parseTimeToMinutes(min) : 0;
  const maxMinutes = max ? parseTimeToMinutes(max) : 24 * 60 - 1;
  for (let m = minMinutes; m <= maxMinutes; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return slots;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

