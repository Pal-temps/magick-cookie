import { onMount, onCleanup, createSignal } from "solid-js";
import { Command } from "@tauri-apps/plugin-shell";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useThemeStore, type Theme } from "../../../application/stores/themeStore";
import "xterm/css/xterm.css";

interface TerminalProps {
  cwd?: string;
}

const THEME_COLORS: Record<Theme, { background: string; foreground: string; cursor: string; selection: string }> = {
  dark: { background: "#0d0d11", foreground: "#e6e6f0", cursor: "#7c6bf5", selection: "#2a2a4480" },
  light: { background: "#f8f7f4", foreground: "#1a1a2e", cursor: "#5b4cd4", selection: "#d8d8e080" },
  cookie: { background: "#2c1e14", foreground: "#f5e6d3", cursor: "#e8a54b", selection: "#5e453580" },
};

export function Terminal(props: TerminalProps) {
  let containerRef: HTMLDivElement | undefined;
  let xterm: XTerm | undefined;
  let fitAddon: FitAddon | undefined;
  let currentLine = "";
  let resizeObserver: ResizeObserver | undefined;

  const { theme } = useThemeStore();
  const [isRunning, setIsRunning] = createSignal(false);

  function writePrompt() {
    const cwd = props.cwd ? props.cwd.split(/[/\\]/).pop() : "~";
    xterm?.write(`\r\n\x1b[36m${cwd}\x1b[0m \x1b[33m>\x1b[0m `);
  }

  async function executeCommand(input: string) {
    const trimmed = input.trim();
    if (!trimmed) {
      writePrompt();
      return;
    }

    // Built-in: clear
    if (trimmed === "clear" || trimmed === "cls") {
      xterm?.clear();
      writePrompt();
      return;
    }

    setIsRunning(true);

    try {
      const platform = navigator.platform.toLowerCase();
      const isWindows = platform.includes("win");

      const cmd = isWindows
        ? Command.create("powershell", ["-NoLogo", "-NoProfile", "-Command", trimmed], { cwd: props.cwd })
        : Command.create("bash", ["-c", trimmed], { cwd: props.cwd });

      cmd.stdout.on("data", (data) => {
        const line = typeof data === "string" ? data : new TextDecoder().decode(data);
        xterm?.write(line.replace(/\n/g, "\r\n"));
      });

      cmd.stderr.on("data", (data) => {
        const line = typeof data === "string" ? data : new TextDecoder().decode(data);
        xterm?.write(`\x1b[31m${line.replace(/\n/g, "\r\n")}\x1b[0m`);
      });

      const child = await cmd.execute();

      if (child.code !== 0 && child.code !== null) {
        xterm?.write(`\r\n\x1b[31m[exit ${child.code}]\x1b[0m`);
      }
    } catch (err) {
      xterm?.write(`\r\n\x1b[31mErreur: ${err}\x1b[0m`);
    } finally {
      setIsRunning(false);
      writePrompt();
    }
  }

  onMount(() => {
    if (!containerRef) return;

    const colors = THEME_COLORS[theme()];

    xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: colors.background,
        foreground: colors.foreground,
        cursor: colors.cursor,
        selectionBackground: colors.selection,
      },
      convertEol: true,
      scrollback: 5000,
    });

    fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef);

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon?.fit();
    });

    // Auto-resize
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon?.fit());
    });
    resizeObserver.observe(containerRef);

    // Welcome message
    xterm.write("\x1b[36mMagick Cookie Terminal\x1b[0m\r\n");
    xterm.write("\x1b[2mTapez une commande puis Entree. 'clear' pour effacer.\x1b[0m");
    writePrompt();

    // Handle input
    xterm.onData((data) => {
      if (isRunning()) return;

      // Enter
      if (data === "\r") {
        xterm?.write("\r\n");
        const cmd = currentLine;
        currentLine = "";
        executeCommand(cmd);
        return;
      }

      // Backspace
      if (data === "\x7f" || data === "\b") {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm?.write("\b \b");
        }
        return;
      }

      // Ctrl+C
      if (data === "\x03") {
        currentLine = "";
        xterm?.write("^C");
        writePrompt();
        return;
      }

      // Ctrl+L (clear)
      if (data === "\x0c") {
        xterm?.clear();
        writePrompt();
        return;
      }

      // Ignore other control chars
      if (data.charCodeAt(0) < 32 && data !== "\t") return;

      // Tab → 2 spaces
      if (data === "\t") {
        currentLine += "  ";
        xterm?.write("  ");
        return;
      }

      // Regular char
      currentLine += data;
      xterm?.write(data);
    });
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    xterm?.dispose();
  });

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
