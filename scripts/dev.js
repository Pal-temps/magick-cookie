#!/usr/bin/env node
// Dev runner with proper shutdown — kills the entire process tree on Ctrl+C.
const { execSync } = require("child_process");
const concurrently = require("concurrently");

const isWindows = process.platform === "win32";
const PORTS = [47300, 47420];

let shuttingDown = false;

function killPorts() {
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
          try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: "pipe" }); } catch {}
        }
      } else {
        const output = execSync(`lsof -ti :${port}`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        for (const pid of output.trim().split("\n").filter(Boolean)) {
          try { execSync(`kill -9 ${pid}`, { stdio: "pipe" }); } catch {}
        }
      }
    } catch {}
  }
}

function shutdown(commands) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[dev] Shutting down...");

  // Kill all concurrently-managed processes
  for (const cmd of commands) {
    if (cmd.pid) {
      try {
        if (isWindows) {
          execSync(`taskkill /F /T /PID ${cmd.pid}`, { stdio: "pipe" });
        } else {
          process.kill(-cmd.pid, "SIGTERM");
        }
      } catch {}
    }
  }

  killPorts();
  console.log("[dev] Shutdown complete.");
  process.exit(0);
}

const { commands, result } = concurrently(
  [
    { command: "bun run api:dev", name: "api", prefixColor: "blue" },
    { command: "bun run desktop:dev", name: "desktop", prefixColor: "green" },
  ],
  { killOthersOn: ["failure", "success"] }
);

process.on("SIGINT", () => shutdown(commands));
process.on("SIGTERM", () => shutdown(commands));

result.then(
  () => { killPorts(); process.exit(0); },
  () => { killPorts(); process.exit(1); }
);
