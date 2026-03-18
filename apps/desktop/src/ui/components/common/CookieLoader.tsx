import { Show } from "solid-js";

interface CookieLoaderProps {
  size?: number;
  message?: string;
}

export function CookieLoader(props: CookieLoaderProps) {
  const size = () => props.size || 48;

  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      gap: "8px",
    }}>
      <img
        src="/loader-cookie.gif"
        alt="Loading..."
        style={{
          width: `${size()}px`,
          height: `${size()}px`,
          "object-fit": "contain",
        }}
      />
      <Show when={props.message}>
        <span style={{
          color: "var(--text-muted)",
          "font-size": "12px",
        }}>
          {props.message}
        </span>
      </Show>
    </div>
  );
}
