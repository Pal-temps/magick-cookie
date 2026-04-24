#!/usr/bin/env node
// Cleanup stale processes on Magick Cookie ports.
// Called automatically via "postdev" or can be run manually.
const { execSync } = require("child_process");

const PORTS = [47300, 47420];
const isWindows = process.platform === "win32";

let killed = 0;

for (const port of PORTS) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      const pids = new Set();
      for (const line of output.trim().split("\n")) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
          console.log(`[shutdown] Killed PID ${pid} on port ${port}`);
          killed++;
        } catch {}
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      for (const pid of output.trim().split("\n").filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "pipe" });
          console.log(`[shutdown] Killed PID ${pid} on port ${port}`);
          killed++;
        } catch {}
      }
    }
  } catch {
    // No process on this port — clean
  }
}

if (killed === 0) {
  console.log("[shutdown] All ports already clean.");
} else {
  console.log(`[shutdown] Cleaned ${killed} stale process(es).`);
}
