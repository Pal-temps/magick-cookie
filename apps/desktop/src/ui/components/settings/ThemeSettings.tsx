import { Show } from "solid-js";
import { useThemeStore, type Theme, type ThemeMode } from "../../../application/stores/themeStore";

const themeVariants: { value: Theme; label: string; icon: string; desc: string }[] = [
  { value: "dark", label: "Sombre", icon: "\u{1F319}", desc: "Fond sombre, texte clair" },
  { value: "light", label: "Clair", icon: "\u2600", desc: "Fond clair, texte sombre" },
  { value: "cookie", label: "Cookie", icon: "\u{1F36A}", desc: "Tons chauds brun et orange" },
];

const autoModes: { value: ThemeMode; label: string; desc: string }[] = [
  { value: "auto-system", label: "Suivre le systeme", desc: "Bascule clair/sombre selon votre OS" },
  { value: "auto-schedule", label: "Horaire automatique", desc: "Bascule selon un horaire defini" },
];

export function ThemeSettings() {
  const { theme, setTheme, themeMode, setMode, schedule, setSchedule } = useThemeStore();

  const isAutoMode = () => themeMode() !== "manual";

  function toggleAutoMode(m: ThemeMode) {
    if (themeMode() === m) {
      // Deselect → back to manual
      setMode("manual");
    } else {
      setMode(m);
    }
  }

  const inputStyle = {
    width: "60px",
    padding: "8px 10px",
    "border-radius": "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    "font-size": "13px",
    "text-align": "center" as const,
    "box-sizing": "border-box" as const,
  };

  const labelStyle = {
    "font-size": "12px",
    "font-weight": "500" as const,
    color: "var(--text-muted)",
    "margin-bottom": "8px",
    display: "block",
  };

  const sectionStyle = {
    "margin-bottom": "24px",
  };

  const helpStyle = {
    "font-size": "11px",
    color: "var(--text-muted)",
    "margin-top": "4px",
  };

  return (
    <div style={{ padding: "24px 32px", "max-width": "600px" }}>
      <h2 style={{ margin: "0 0 4px", "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>
        Apparence
      </h2>
      <p style={{ margin: "0 0 24px", "font-size": "13px", color: "var(--text-muted)" }}>
        Choisissez le theme de l'application
      </p>

      {/* Theme picker */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Theme</label>
        <div style={{ display: "flex", gap: "8px" }}>
          {themeVariants.map((v) => (
            <button
              onClick={() => setTheme(v.value)}
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                gap: "6px",
                padding: "14px 20px",
                "border-radius": "var(--radius-md)",
                border: theme() === v.value ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                background: theme() === v.value ? "var(--bg-elevated)" : "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                "min-width": "90px",
                opacity: isAutoMode() ? "0.5" : "1",
              }}
            >
              <span style={{ "font-size": "24px" }}>{v.icon}</span>
              <span style={{ "font-size": "12px", "font-weight": theme() === v.value ? "600" : "400" }}>{v.label}</span>
              <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>{v.desc}</span>
            </button>
          ))}
        </div>
        <Show when={isAutoMode()}>
          <div style={helpStyle}>
            Le theme est gere automatiquement. Choisir un theme desactive le mode auto.
          </div>
        </Show>
      </div>

      {/* Auto switching */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Basculement automatique</label>
        <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
          {autoModes.map((opt) => (
            <button
              onClick={() => toggleAutoMode(opt.value)}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "10px",
                padding: "10px 12px",
                "border-radius": "var(--radius-md)",
                border: themeMode() === opt.value ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                background: themeMode() === opt.value ? "var(--bg-elevated)" : "transparent",
                color: "var(--text-primary)",
                "font-size": "13px",
                cursor: "pointer",
                "text-align": "left",
              }}
            >
              <div style={{
                width: "16px",
                height: "16px",
                "border-radius": "50%",
                border: themeMode() === opt.value ? "5px solid var(--accent-primary)" : "2px solid var(--border-color)",
                "flex-shrink": "0",
                "box-sizing": "border-box",
              }} />
              <div>
                <div style={{ "font-weight": "500" }}>{opt.label}</div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "1px" }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule config */}
      <Show when={themeMode() === "auto-schedule"}>
        <div style={sectionStyle}>
          <label style={labelStyle}>Horaire du mode sombre</label>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={{ "font-size": "13px", color: "var(--text-primary)" }}>De</span>
            <input
              type="number"
              min="0"
              max="23"
              value={schedule().darkStart}
              onInput={(e) => setSchedule({ ...schedule(), darkStart: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
              style={inputStyle}
            />
            <span style={{ "font-size": "13px", color: "var(--text-primary)" }}>h a</span>
            <input
              type="number"
              min="0"
              max="23"
              value={schedule().darkEnd}
              onInput={(e) => setSchedule({ ...schedule(), darkEnd: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
              style={inputStyle}
            />
            <span style={{ "font-size": "13px", color: "var(--text-primary)" }}>h</span>
          </div>
          <div style={helpStyle}>
            Le theme sombre sera actif de {schedule().darkStart}h00 a {schedule().darkEnd}h00
          </div>
        </div>
      </Show>
    </div>
  );
}
