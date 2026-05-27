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
      class={`btn btn-${variant()} btn-${size()} ${props.class ?? ""}`.trim()}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      style={props.style}
    >
      {props.children}
    </button>
  );
}
