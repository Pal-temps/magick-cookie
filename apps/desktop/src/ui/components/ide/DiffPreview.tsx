import { onMount, onCleanup, createEffect, on } from "solid-js";
import * as monaco from "monaco-editor";
import { useThemeStore, type Theme } from "../../../application/stores/themeStore";

interface DiffPreviewProps {
  original: string;
  modified: string;
  language: string;
}

const THEME_MAP: Record<Theme, string> = {
  dark: "vs-dark",
  light: "vs",
  cookie: "magick-cookie",
};

export function DiffPreview(props: DiffPreviewProps) {
  let containerRef: HTMLDivElement | undefined;
  let diffEditor: monaco.editor.IStandaloneDiffEditor | undefined;
  const { theme } = useThemeStore();

  onMount(() => {
    if (!containerRef) return;

    diffEditor = monaco.editor.createDiffEditor(containerRef, {
      readOnly: true,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      theme: THEME_MAP[theme()],
      padding: { top: 4 },
    });

    const originalModel = monaco.editor.createModel(props.original, props.language);
    const modifiedModel = monaco.editor.createModel(props.modified, props.language);

    diffEditor.setModel({ original: originalModel, modified: modifiedModel });
  });

  // Sync theme
  createEffect(on(theme, (t) => {
    monaco.editor.setTheme(THEME_MAP[t]);
  }));

  // Sync content
  createEffect(on(
    () => [props.original, props.modified],
    ([orig, mod]) => {
      if (!diffEditor) return;
      const model = diffEditor.getModel();
      if (model) {
        model.original.setValue(orig);
        model.modified.setValue(mod);
      }
    },
  ));

  onCleanup(() => {
    const model = diffEditor?.getModel();
    model?.original.dispose();
    model?.modified.dispose();
    diffEditor?.dispose();
  });

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "200px", border: "1px solid var(--border-color)", "border-radius": "4px", overflow: "hidden" }}
    />
  );
}
