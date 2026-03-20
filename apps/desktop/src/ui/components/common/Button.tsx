import type { JSX } from "solid-js";

export interface ButtonProps {
  children: JSX.Element;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  class?: string;
  style?: JSX.CSSProperties;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
}

export function Button(props: ButtonProps) {
  const variant = () => props.variant ?? "secondary";
  const size = () => props.size ?? "md";

  return (
    <button
      type={props.type ?? "button"}
      class={`btn btn-${variant()} btn-${size()} ${props.class ?? ""}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      style={{
        ...props.style,
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        gap: "6px",
        "border-radius": "var(--radius-md)",
        "font-weight": "500",
        transition: "var(--transition-fast)",
        padding: size() === "sm" ? "4px 10px" : "8px 16px",
        "font-size": size() === "sm" ? "12px" : "14px",
        background: variant() === "primary" ? "var(--accent-primary)" :
                    variant() === "danger" ? "var(--cal-red)" :
                    variant() === "ghost" ? "transparent" : "var(--bg-elevated)",
        color: variant() === "primary" ? "var(--accent-primary-text)" :
               variant() === "danger" ? "#ffffff" :
               variant() === "ghost" ? "var(--text-secondary)" : "var(--text-primary)",
        border: variant() === "ghost" ? "none" : "1px solid var(--border-color)",
        opacity: props.disabled ? "0.5" : "1",
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </button>
  );
}
