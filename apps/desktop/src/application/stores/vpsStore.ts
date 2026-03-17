import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { connectGenericSSE } from "../../infrastructure/api/genericSSEClient";
import { notify } from "../../infrastructure/tauri/notifications";

export interface VpsLogLine {
  file: string;
  line: string;
  level: string;
  timestamp: string;
}

export interface VpsAlert {
  kind: string;
  severity: "error" | "warning" | "info";
  message: string;
  timestamp: string;
}

export interface VpsService {
  name: string;
  status: "up" | "down" | "degraded";
  details?: string;
}

export interface VpsHealth {
  services: VpsService[];
}

export interface VpsLogFile {
  name: string;
  size_bytes: number;
  size_human: string;
  last_modified: string | null;
}

const MAX_LOG_LINES = 500;

const [logs, setLogs] = createSignal<VpsLogLine[]>([]);
const [alerts, setAlerts] = createSignal<VpsAlert[]>([]);
const [health, setHealth] = createSignal<VpsHealth | null>(null);
const [logFiles, setLogFiles] = createSignal<VpsLogFile[]>([]);
const [isConnected, setIsConnected] = createSignal(false);
const [selectedFile, setSelectedFile] = createSignal("app.log");
const [levelFilter, setLevelFilter] = createSignal("ALL");
const [alertCount, setAlertCount] = createSignal(0);

let disconnectSSE: (() => void) | null = null;

export function useVpsStore() {
  function connect() {
    if (disconnectSSE) disconnectSSE();

    const params = new URLSearchParams();
    const file = selectedFile();
    if (file) params.set("files", file);
    const level = levelFilter();
    if (level !== "ALL") params.set("level", level);

    const url = `http://localhost:47300/api/vps/stream?${params.toString()}`;

    disconnectSSE = connectGenericSSE(url, {
      log: (data: VpsLogLine) => {
        setLogs((prev) => {
          const next = [...prev, data];
          return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
        });
      },
      alert: (data: VpsAlert) => {
        setAlerts((prev) => [data, ...prev].slice(0, 50));
        setAlertCount((c) => c + 1);
        // Send system notification for errors
        if (data.severity === "error") {
          notify("VPS Alert", data.message);
        }
      },
      heartbeat: () => {
        setIsConnected(true);
      },
      error: () => {
        setIsConnected(false);
      },
    }, { reconnectMs: 5000 });

    setIsConnected(true);
  }

  function disconnect() {
    disconnectSSE?.();
    disconnectSSE = null;
    setIsConnected(false);
  }

  async function fetchHealth() {
    try {
      const data = await api.get<VpsHealth>("/vps/health");
      setHealth(data);
    } catch {
      setHealth(null);
    }
  }

  async function fetchLogFiles() {
    try {
      const data = await api.get<{ files: VpsLogFile[] }>("/vps/logs");
      setLogFiles(data.files);
    } catch {
      setLogFiles([]);
    }
  }

  async function fetchLogs(filename?: string, lines?: number) {
    try {
      const params = new URLSearchParams();
      if (lines) params.set("lines", String(lines));
      const level = levelFilter();
      if (level !== "ALL") params.set("level", level);
      const file = filename || selectedFile();
      const data = await api.get<{ lines: string[] }>(`/vps/logs/${file}?${params.toString()}`);
      // Convert string lines to VpsLogLine objects
      const logLines: VpsLogLine[] = data.lines.map((line) => {
        const levelMatch = line.match(/\b(ERROR|WARNING|INFO|DEBUG|CRITICAL)\b/);
        const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
        return {
          file,
          line,
          level: levelMatch?.[1] || "INFO",
          timestamp: tsMatch?.[1] || "",
        };
      });
      setLogs(logLines);
    } catch {
      // Keep existing logs
    }
  }

  async function flushLogs() {
    try {
      await api.delete("/vps/logs");
      setLogs([]);
      await fetchLogFiles();
    } catch (e) {
      console.error("Failed to flush logs:", e);
    }
  }

  async function fetchAlerts() {
    try {
      const data = await api.get<{ alerts: VpsAlert[] }>("/vps/alerts");
      setAlerts(data.alerts);
    } catch {
      // Keep existing alerts
    }
  }

  function clearAlertCount() {
    setAlertCount(0);
  }

  return {
    logs,
    alerts,
    health,
    logFiles,
    isConnected,
    selectedFile,
    setSelectedFile,
    levelFilter,
    setLevelFilter,
    alertCount,
    connect,
    disconnect,
    fetchHealth,
    fetchLogFiles,
    fetchLogs,
    flushLogs,
    fetchAlerts,
    clearAlertCount,
  };
}
