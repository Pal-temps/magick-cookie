#!/usr/bin/env node
// Kill processes occupying ports used by Magick Cookie
// API: 47300, Vite desktop: 47420
const { execSync } = require("child_process");

const PORTS = [47300, 47420];
const isWindows = process.platform === "win32";

for (const port of PORTS) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf-8" });
      const pids = new Set();
      for (const line of output.trim().split("\n")) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
          console.log(`Killed PID ${pid} on port ${port}`);
        } catch {}
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, { encoding: "utf-8" });
      const pids = output.trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "pipe" });
          console.log(`Killed PID ${pid} on port ${port}`);
        } catch {}
      }
    }
  } catch {
    // No process on this port — that's fine
  }
}

console.log("Ports cleared.");
