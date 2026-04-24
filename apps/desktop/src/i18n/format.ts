import type { Locale } from "./types";

const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};

export function formatDate(date: Date, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(INTL_LOCALE[locale], opts);
}

export function formatTime(date: Date, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleTimeString(INTL_LOCALE[locale], opts ?? { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(date: Date, locale: Locale): string {
  return date.toLocaleString(INTL_LOCALE[locale], {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(INTL_LOCALE[locale], opts);
}

export function formatRelativeDay(date: Date, locale: Locale): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return locale === "fr" ? "Aujourd'hui" : "Today";
  if (diff === 1) return locale === "fr" ? "Hier" : "Yesterday";
  if (diff === -1) return locale === "fr" ? "Demain" : "Tomorrow";
  return formatDate(date, locale, { day: "numeric", month: "long" });
}

export function intlLocale(locale: Locale): string {
  return INTL_LOCALE[locale];
}
