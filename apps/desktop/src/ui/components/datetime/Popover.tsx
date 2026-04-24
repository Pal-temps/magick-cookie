import { type JSX, Show, onMount, onCleanup, createSignal } from "solid-js";

interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: JSX.Element;
  triggerRef?: HTMLElement;
}

export function Popover(props: PopoverProps) {
  let popoverRef: HTMLDivElement | undefined;
  const [flipUp, setFlipUp] = createSignal(false);

  function handleClickOutside(e: PointerEvent) {
    if (!props.isOpen) return;
    const target = e.target as Node;
    if (popoverRef && !popoverRef.contains(target) && !props.triggerRef?.contains(target)) {
      props.onClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (props.isOpen && e.key === "Escape") {
      e.stopPropagation();
      props.onClose();
    }
  }

  onMount(() => {
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("pointerdown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  function checkFlip(el: HTMLDivElement) {
    popoverRef = el;
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8) {
        setFlipUp(true);
      } else {
        setFlipUp(false);
      }
    });
  }

  return (
    <Show when={props.isOpen}>
      <div
        ref={checkFlip}
        style={{
          position: "absolute",
          left: "0",
          [flipUp() ? "bottom" : "top"]: "100%",
          "margin-top": flipUp() ? "0" : "4px",
          "margin-bottom": flipUp() ? "4px" : "0",
          "z-index": "200",
          width: "max-content",
        }}
      >
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          "border-radius": "var(--radius-lg)",
          "box-shadow": "0 8px 24px rgba(0, 0, 0, 0.25)",
        }}>
          {props.children}
        </div>
      </div>
    </Show>
  );
}
