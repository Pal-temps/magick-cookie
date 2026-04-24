import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    solid(),
    (monacoEditorPlugin as any).default({
      languageWorkers: ["editorWorkerService", "typescript"],
    }),
  ],

  // Ensure a single instance of Solid (prevents "multiple instances" warning)
  resolve: {
    dedupe: ["solid-js", "solid-js/web", "solid-js/store"],
  },

  // Code-split heavy dependencies into separate chunks (loaded on demand with lazy views).
  // Each entry here pulls ~0.5-4 MB out of the main bundle; the chunks are only fetched when the
  // corresponding lazy view mounts.
  build: {
    // Heavy editors/renderers exceed 500kB individually — the default warning is noise here
    // since these chunks are loaded on demand, not on first paint.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "monaco": ["monaco-editor"],
          "react-excalidraw": ["react", "react-dom", "@excalidraw/excalidraw"],
          "xterm": ["xterm", "@xterm/addon-fit"],
          "leaflet": ["leaflet"],
          "markdown": ["marked", "highlight.js"],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 47420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 47421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
