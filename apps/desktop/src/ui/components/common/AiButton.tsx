import { type JSX } from "solid-js";
import { Button } from "./Button";
import { isLlmConfigured } from "../../../application/stores/llmStore";
import { useViewStore } from "../../../application/stores/viewStore";

interface AiButtonProps {
  children: JSX.Element;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  style?: JSX.CSSProperties;
  disabled?: boolean;
}

/**
 * A Button that automatically disables itself when no LLM is configured.
 * Clicking while disabled navigates to Settings > IA configuration.
 */
export function AiButton(props: AiButtonProps) {
  const { openSettings } = useViewStore();
  const configured = () => isLlmConfigured();

  function handleClick() {
    if (!configured()) {
      openSettings("llm");
      return;
    }
    props.onClick?.();
  }

  return (
    <Button
      size={props.size}
      variant={configured() ? (props.variant ?? "secondary") : "ghost"}
      onClick={handleClick}
      disabled={configured() ? props.disabled : false}
      title={configured() ? undefined : "IA non configuree — cliquez pour ouvrir les reglages"}
      style={{
        ...props.style,
        ...(!configured() ? { opacity: "0.5", cursor: "pointer" } : {}),
      }}
    >
      {props.children}
    </Button>
  );
}
