import { createSignal, type JSX, Show } from "solid-js";

interface CollapsibleSectionProps {
  title: string;
  children: JSX.Element;
  defaultOpen?: boolean;
  badge?: JSX.Element;
  action?: JSX.Element;
}

export function CollapsibleSection(props: CollapsibleSectionProps) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? true);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          width: "100%",
          padding: "8px 12px",
          "text-align": "left",
          "font-size": "11px",
          "font-weight": "600",
          color: "var(--text-muted)",
          "text-transform": "uppercase",
          "letter-spacing": "0.5px",
        }}
      >
        <span style={{
          "font-size": "9px",
          transition: "transform 0.15s",
          transform: open() ? "rotate(90deg)" : "rotate(0deg)",
          "flex-shrink": "0",
        }}>
          &#9654;
        </span>
        <span style={{ flex: "1" }}>{props.title}</span>
        {props.badge}
        <Show when={props.action}>
          <span onClick={(e) => e.stopPropagation()}>
            {props.action}
          </span>
        </Show>
      </button>
      <Show when={open()}>
        <div style={{ padding: "0 12px 8px" }}>
          {props.children}
        </div>
      </Show>
    </div>
  );
}
