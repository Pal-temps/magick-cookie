import { createSignal, onCleanup, Show } from "solid-js";

// Spritesheet: 1536x1024, 5 frames horizontally → each frame ~307x1024
const FRAME_COUNT = 5;
const SHEET_W = 1536;
const SHEET_H = 1024;
const FRAME_W = SHEET_W / FRAME_COUNT; // 307.2

interface CookieLoaderProps {
  size?: number;
  message?: string;
}

export function CookieLoader(props: CookieLoaderProps) {
  const size = () => props.size || 48;
  const [frame, setFrame] = createSignal(0);

  const interval = setInterval(() => {
    setFrame((f) => (f + 1) % FRAME_COUNT);
  }, 300);

  onCleanup(() => clearInterval(interval));

  // Scale so each frame width = size
  const scale = () => size() / FRAME_W;
  const bgW = () => SHEET_W * scale();
  const bgH = () => SHEET_H * scale();
  // Horizontal offset for current frame
  const offsetX = () => -(frame() * FRAME_W * scale());
  // Vertical offset to center the cookie in a square crop
  const offsetY = () => -(bgH() - size()) / 2;

  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      gap: "8px",
    }}>
      <div style={{
        width: `${size()}px`,
        height: `${size()}px`,
        overflow: "hidden",
        "background-image": "url(/loader-cookie.png)",
        "background-size": `${bgW()}px ${bgH()}px`,
        "background-position": `${offsetX()}px ${offsetY()}px`,
        "background-repeat": "no-repeat",
      }} />
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
