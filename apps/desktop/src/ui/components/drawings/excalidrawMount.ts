// React wrapper for Excalidraw — uses createElement (no JSX) to avoid SolidJS JSX conflict
import React from "react";
import ReactDOM from "react-dom/client";
import "@excalidraw/excalidraw/index.css";

let Excalidraw: any = null;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded() {
  if (Excalidraw) return;
  if (!loadPromise) {
    loadPromise = import("@excalidraw/excalidraw").then((mod) => {
      Excalidraw = mod.Excalidraw;
    });
  }
  await loadPromise;
}

export interface ExcalidrawHandle {
  destroy: () => void;
  getContent: () => string;
}

export async function mountExcalidraw(
  container: HTMLElement,
  initialContent: string,
  onChange: (content: string) => void,
  theme: "light" | "dark",
): Promise<ExcalidrawHandle> {
  await ensureLoaded();

  let currentElements: any[] = [];
  let currentAppState: any = {};
  let currentFiles: any = {};

  // Parse initial data
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue("--excalidraw-bg").trim() || (theme === "dark" ? "#1e1e2e" : "#ffffff");
  const defaultAppState = { theme, viewBackgroundColor: bgColor };
  let initialData: any = { elements: [], appState: defaultAppState, files: {} };
  if (initialContent.trim()) {
    try {
      const parsed = JSON.parse(initialContent);
      initialData = {
        elements: parsed.elements || [],
        appState: { ...defaultAppState, ...parsed.appState, theme },
        files: parsed.files || {},
      };
      currentElements = initialData.elements;
      currentAppState = initialData.appState;
      currentFiles = initialData.files;
    } catch {
      // Invalid JSON, start empty
    }
  }

  const root = ReactDOM.createRoot(container);

  const excalidrawProps = {
    initialData,
    theme,
    onChange: (elements: any[], appState: any, files: any) => {
      currentElements = elements;
      currentAppState = appState;
      currentFiles = files;
      const content = JSON.stringify({
        type: "excalidraw",
        version: 2,
        elements,
        appState: {
          gridSize: appState.gridSize,
          viewBackgroundColor: appState.viewBackgroundColor,
        },
        files: files || {},
      });
      onChange(content);
    },
    langCode: "fr-FR",
    UIOptions: {
      canvasActions: {
        loadScene: false,
        export: false,
      },
    },
  };

  root.render(React.createElement(Excalidraw, excalidrawProps));

  return {
    destroy: () => {
      root.unmount();
    },
    getContent: () => {
      return JSON.stringify({
        type: "excalidraw",
        version: 2,
        elements: currentElements,
        appState: {
          gridSize: currentAppState.gridSize,
          viewBackgroundColor: currentAppState.viewBackgroundColor,
        },
        files: currentFiles || {},
      });
    },
  };
}
