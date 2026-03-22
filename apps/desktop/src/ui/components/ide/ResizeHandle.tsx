import { createSignal } from "solid-js";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
}

export function ResizeHandle(props: ResizeHandleProps) {
  const [dragging, setDragging] = createSignal(false);

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;

    const onMouseMove = (e: MouseEvent) => {
      props.onResize(startX - e.clientX);
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      class={`ide-resize-handle ${dragging() ? "ide-resize-handle--active" : ""}`}
      onMouseDown={onMouseDown}
    />
  );
}
