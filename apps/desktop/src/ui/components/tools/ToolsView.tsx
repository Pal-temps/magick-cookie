import { EnvChecker } from "./EnvChecker";
import { ChangelogGenerator } from "./ChangelogGenerator";

export function ToolsView() {
  return (
    <div style={{
      height: "100%",
      overflow: "auto",
      padding: "20px 24px",
      display: "flex",
      "flex-direction": "column",
      gap: "24px",
    }}>
      {/* Page title */}
      <h2 style={{
        margin: "0",
        "font-size": "18px",
        "font-weight": "600",
        color: "var(--text-primary)",
      }}>
        Outils
      </h2>

      {/* Environment Checker section */}
      <section style={{
        padding: "16px",
        background: "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: "1px solid var(--border-color)",
      }}>
        <EnvChecker />
      </section>

      {/* Changelog Generator section */}
      <section style={{
        padding: "16px",
        background: "var(--bg-surface)",
        "border-radius": "var(--radius-md)",
        border: "1px solid var(--border-color)",
      }}>
        <ChangelogGenerator />
      </section>
    </div>
  );
}
