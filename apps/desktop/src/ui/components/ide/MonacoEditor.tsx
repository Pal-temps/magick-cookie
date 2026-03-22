import { onMount, onCleanup, createEffect, on } from "solid-js";
import * as monaco from "monaco-editor";
import { useThemeStore, type Theme } from "../../../application/stores/themeStore";

export type AiActionType = "explain" | "refactor" | "fix" | "tests" | "document";

export interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  path?: string;
  class?: string;
  style?: Record<string, string>;
  onAiAction?: (action: AiActionType, selectedCode: string) => void;
  ref?: (api: MonacoEditorApi) => void;
}

export interface MonacoEditorApi {
  getSelection: () => string;
  getValue: () => string;
  insertAtCursor: (text: string) => void;
}

const THEME_MAP: Record<Theme, string> = {
  dark: "vs-dark",
  light: "vs",
  cookie: "magick-cookie",
};

let cookieThemeRegistered = false;

function registerCookieTheme() {
  if (cookieThemeRegistered) return;
  cookieThemeRegistered = true;

  monaco.editor.defineTheme("magick-cookie", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "f5e6d3", background: "2c1e14" },
      { token: "comment", foreground: "8c7560", fontStyle: "italic" },
      { token: "keyword", foreground: "e8a54b" },
      { token: "string", foreground: "7cb342" },
      { token: "number", foreground: "f0a030" },
      { token: "type", foreground: "c46a2c" },
      { token: "variable", foreground: "c4a882" },
      { token: "function", foreground: "f0b85e" },
      { token: "operator", foreground: "f5e6d3" },
      { token: "delimiter", foreground: "8c7560" },
      { token: "tag", foreground: "e8a54b" },
      { token: "attribute.name", foreground: "c46a2c" },
      { token: "attribute.value", foreground: "7cb342" },
    ],
    colors: {
      "editor.background": "#2c1e14",
      "editor.foreground": "#f5e6d3",
      "editor.lineHighlightBackground": "#3d2b1e",
      "editor.selectionBackground": "#5e453580",
      "editor.inactiveSelectionBackground": "#4e382840",
      "editorCursor.foreground": "#e8a54b",
      "editorLineNumber.foreground": "#8c7560",
      "editorLineNumber.activeForeground": "#c4a882",
      "editorIndentGuide.background": "#3d2b1e",
      "editorIndentGuide.activeBackground": "#5a3f2a",
      "editor.selectionHighlightBackground": "#5e453530",
      "editorBracketMatch.background": "#5a3f2a40",
      "editorBracketMatch.border": "#7a5a3e",
      "editorWidget.background": "#3d2b1e",
      "editorWidget.border": "#5a3f2a",
      "editorSuggestWidget.background": "#3d2b1e",
      "editorSuggestWidget.border": "#5a3f2a",
      "editorSuggestWidget.selectedBackground": "#4e3828",
      "input.background": "#3d2b1e",
      "input.border": "#5a3f2a",
      "input.foreground": "#f5e6d3",
      "scrollbarSlider.background": "#5a3f2a60",
      "scrollbarSlider.hoverBackground": "#7a5a3e80",
      "scrollbarSlider.activeBackground": "#7a5a3ea0",
    },
  });
}

function getMonacoTheme(appTheme: Theme): string {
  if (appTheme === "cookie") registerCookieTheme();
  return THEME_MAP[appTheme];
}

function detectLanguage(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", scss: "scss", html: "html",
    rs: "rust", py: "python", go: "go", sh: "shell", bash: "shell",
    yml: "yaml", yaml: "yaml", toml: "ini", sql: "sql", xml: "xml",
    java: "java", kt: "kotlin", rb: "ruby", php: "php", c: "c",
    cpp: "cpp", h: "cpp", cs: "csharp", swift: "swift", dart: "dart",
    lua: "lua", r: "r", svelte: "html", vue: "html",
  };
  return map[ext ?? ""] ?? fallback;
}

export function MonacoEditor(props: MonacoEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let ignoreChange = false;

  const { theme } = useThemeStore();

  onMount(() => {
    if (!containerRef) return;

    const lang = detectLanguage(props.path, props.language);

    editor = monaco.editor.create(containerRef, {
      value: props.value,
      language: lang,
      theme: getMonacoTheme(theme()),
      readOnly: props.readOnly ?? false,
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: "on",
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      wordWrap: lang === "markdown" ? "on" : "off",
      tabSize: 2,
      bracketPairColorization: { enabled: true },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      padding: { top: 8 },
    });

    if (props.onChange) {
      editor.onDidChangeModelContent(() => {
        if (ignoreChange) return;
        props.onChange?.(editor!.getValue());
      });
    }

    // Expose API via ref
    if (props.ref) {
      props.ref({
        getSelection: () => {
          const sel = editor!.getSelection();
          return sel ? editor!.getModel()?.getValueInRange(sel) ?? "" : "";
        },
        getValue: () => editor!.getValue(),
        insertAtCursor: (text: string) => {
          const sel = editor!.getSelection();
          if (sel) {
            editor!.executeEdits("ai-insert", [{ range: sel, text }]);
          }
        },
      });
    }

    // Register AI context menu actions
    if (props.onAiAction) {
      const actions: { id: string; label: string; action: AiActionType }[] = [
        { id: "ai.explain", label: "IA: Expliquer", action: "explain" },
        { id: "ai.refactor", label: "IA: Refactorer", action: "refactor" },
        { id: "ai.fix", label: "IA: Corriger", action: "fix" },
        { id: "ai.tests", label: "IA: Generer des tests", action: "tests" },
        { id: "ai.document", label: "IA: Documenter", action: "document" },
      ];

      for (const a of actions) {
        editor.addAction({
          id: a.id,
          label: a.label,
          contextMenuGroupId: "ai",
          contextMenuOrder: 1,
          run: (ed) => {
            const sel = ed.getSelection();
            const code = sel ? ed.getModel()?.getValueInRange(sel) ?? "" : ed.getValue();
            props.onAiAction!(a.action, code);
          },
        });
      }
    }
  });

  // Sync value from parent
  createEffect(on(() => props.value, (val) => {
    if (!editor) return;
    if (editor.getValue() !== val) {
      ignoreChange = true;
      editor.setValue(val);
      ignoreChange = false;
    }
  }));

  // Sync language
  createEffect(on(() => props.language, (lang) => {
    if (!editor) return;
    const model = editor.getModel();
    if (model) {
      const resolved = detectLanguage(props.path, lang);
      monaco.editor.setModelLanguage(model, resolved);
    }
  }));

  // Sync theme
  createEffect(on(theme, (t) => {
    monaco.editor.setTheme(getMonacoTheme(t));
  }));

  // Sync readOnly
  createEffect(on(() => props.readOnly, (ro) => {
    editor?.updateOptions({ readOnly: ro ?? false });
  }));

  onCleanup(() => {
    editor?.dispose();
  });

  return (
    <div
      ref={containerRef}
      class={props.class}
      style={{ width: "100%", height: "100%", ...props.style }}
    />
  );
}
