import { onMount, onCleanup } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useThemeStore, type Theme } from "../../../application/stores/themeStore";
import { ptyService } from "../../../application/services/ptyService";
import "xterm/css/xterm.css";

interface TerminalProps {
  cwd?: string;
  /** Command to auto-type into the shell once PTY is ready (e.g. "claude") */
  autoCommand?: string;
}

const THEME_COLORS: Record<Theme, { background: string; foreground: string; cursor: string; selection: string }> = {
  dark: { background: "#0d0d11", foreground: "#e6e6f0", cursor: "#7c6bf5", selection: "#2a2a4480" },
  light: { background: "#f8f7f4", foreground: "#1a1a2e", cursor: "#5b4cd4", selection: "#d8d8e080" },
  cookie: { background: "#2c1e14", foreground: "#f5e6d3", cursor: "#e8a54b", selection: "#5e453580" },
};

let ptyCounter = 0;

export function Terminal(props: TerminalProps) {
  let containerRef: HTMLDivElement | undefined;
  let xterm: XTerm | undefined;
  let fitAddon: FitAddon | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let unlisten: UnlistenFn | undefined;
  const ptyId = `pty-${++ptyCounter}-${Date.now()}`;

  const { theme } = useThemeStore();

  onMount(async () => {
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
      scrollback: 10000,
    });

    fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef);

    // Initial fit
    requestAnimationFrame(() => fitAddon?.fit());

    // Auto-resize
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon?.fit();
        if (xterm) ptyService.resize(ptyId, xterm.cols, xterm.rows);
      });
    });
    resizeObserver.observe(containerRef);

    // Listen for PTY output
    unlisten = await listen<{ id: string; data: string }>("pty-data", (event) => {
      if (event.payload.id === ptyId) {
        xterm?.write(event.payload.data);
      }
    });

    // Forward all xterm input to PTY (keystroke by keystroke)
    xterm.onData((data) => ptyService.write(ptyId, data));

    // Spawn the PTY shell (always a real shell — no custom command)
    try {
      await ptyService.spawn(ptyId, props.cwd ?? ".", xterm.cols, xterm.rows);

      // Auto-type a command into the shell once it's ready
      if (props.autoCommand) {
        const cmd = props.autoCommand;
        setTimeout(() => ptyService.write(ptyId, cmd + "\r"), 500);
      }
    } catch (err) {
      xterm.write(`\x1b[31mErreur PTY: ${err}\x1b[0m\r\n`);
      xterm.write("\x1b[2mFallback: utilisez le terminal systeme.\x1b[0m\r\n");
    }
  });

  onCleanup(() => {
    unlisten?.();
    resizeObserver?.disconnect();
    ptyService.kill(ptyId);
    xterm?.dispose();
  });

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
