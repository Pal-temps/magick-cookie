import { useT } from "../../../i18n/context";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import type { Locale } from "../../../i18n/types";

const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

export function LocaleSettings() {
  const { t, locale, setLocale } = useT();
  const settings = useSettingsStore();

  function handleChange(newLocale: Locale) {
    setLocale(newLocale);
    settings.setLocale(newLocale);
  }

  return (
    <div style={{ padding: "16px" }}>
      <h3 style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)", "margin-bottom": "12px" }}>
        {t("settings.language")}
      </h3>
      <div style={{ display: "flex", gap: "8px" }}>
        {LOCALES.map((loc) => (
          <button
            style={{
              display: "flex", "align-items": "center", gap: "8px",
              padding: "10px 16px", "border-radius": "8px", cursor: "pointer",
              border: locale() === loc.value ? "2px solid var(--accent-primary)" : "2px solid var(--border-color)",
              background: locale() === loc.value ? "color-mix(in srgb, var(--accent-primary) 10%, var(--bg-base))" : "var(--bg-base)",
              color: "var(--text-primary)", "font-size": "13px", "font-weight": "500",
              transition: "all 0.15s",
            }}
            onClick={() => handleChange(loc.value)}
          >
            <span style={{ "font-size": "20px" }}>{loc.flag}</span>
            <span>{loc.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
