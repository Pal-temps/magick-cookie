import { createContext, useContext, createSignal, type ParentComponent } from "solid-js";
import type { Locale, Dictionary } from "./types";
import { dict as frDict } from "./fr";
import { dict as enDict } from "./en";

const DICTS: Record<Locale, Dictionary> = { fr: frDict, en: enDict };

function getNestedValue(obj: any, path: string): string | undefined {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

interface I18nContextValue {
  t: (key: string) => string;
  locale: () => Locale;
  setLocale: (l: Locale) => void;
  dict: () => Dictionary;
}

// Default value — no signals, no computations, just plain functions
const defaultValue: I18nContextValue = {
  t: (key: string) => getNestedValue(frDict, key) ?? key,
  locale: () => "fr" as Locale,
  setLocale: () => {},
  dict: () => frDict,
};
const I18nContext = createContext<I18nContextValue>(defaultValue);

export const I18nProvider: ParentComponent<{ initialLocale?: Locale }> = (props) => {
  const stored = localStorage.getItem("magick-cookie-locale") as Locale | null;
  const [locale, setLocaleSignal] = createSignal<Locale>(stored ?? props.initialLocale ?? "fr");

  // Plain function, no createMemo — avoids "computations outside createRoot" warnings
  const getDict = () => DICTS[locale()];
  const t = (key: string): string => getNestedValue(getDict(), key) ?? key;

  function setLocale(l: Locale) {
    setLocaleSignal(l);
    localStorage.setItem("magick-cookie-locale", l);
  }

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, dict: getDict }}>
      {props.children}
    </I18nContext.Provider>
  );
};

export function useT() {
  return useContext(I18nContext)!;
}

export type { Locale, Dictionary };
