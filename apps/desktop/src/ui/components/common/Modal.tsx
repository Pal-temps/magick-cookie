import { type JSX, Show } from "solid-js";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
}

export function Modal(props: ModalProps) {
  return (
    <Show when={props.isOpen}>
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "100",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "background-color": "rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      >
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            "border-radius": "var(--radius-lg)",
            padding: "24px",
            "min-width": "440px",
            "max-width": "560px",
            "max-height": "80vh",
            "overflow-y": "auto",
          }}
        >
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "20px" }}>
            <h2 style={{ "font-size": "18px", "font-weight": "600" }}>{props.title}</h2>
            <button
              onClick={props.onClose}
              aria-label="Close"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "border-radius": "var(--radius-sm)",
                color: "var(--text-secondary)",
                "font-size": "18px",
              }}
            >
              &times;
            </button>
          </div>
          {props.children}
        </div>
      </div>
    </Show>
  );
}
