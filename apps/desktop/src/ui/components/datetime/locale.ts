import type { Locale } from "./types";

export interface LocaleData {
  months: string[];
  monthsShort: string[];
  days: string[];
  today: string;
  at: string;
}

const FR: LocaleData = {
  months: ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"],
  monthsShort: ["janv.", "fevr.", "mars", "avr.", "mai", "juin", "juil.", "aout", "sept.", "oct.", "nov.", "dec."],
  days: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
  today: "Aujourd'hui",
  at: "a",
};

const EN: LocaleData = {
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  today: "Today",
  at: "at",
};

const LOCALES: Record<Locale, LocaleData> = { fr: FR, en: EN };

export function getLocale(locale: Locale = "fr"): LocaleData {
  return LOCALES[locale] ?? FR;
}
