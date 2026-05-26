#!/usr/bin/env node
/**
 * dev-empty — Lance l'app contre une DB de test vide.
 *
 * Usage:
 *   bun run dev:empty
 *   TEST_DATABASE_URL=postgres://... bun run dev:empty   (DB custom)
 *
 * Ce que ça fait :
 *   1. Libère les ports 47300 / 47420
 *   2. Démarre le container Docker si besoin
 *   3. Reset magick_cookie_test (drop + re-migrate = DB vide propre)
 *   4. Lance API (→ test DB) + Desktop en parallèle (même que `dev`)
 */

const { execSync, execFileSync } = require("child_process");
const concurrently = require("concurrently");

// ─── Config ──────────────────────────────────────────────────────────────────

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:47532/magick_cookie_test";

const isWindows = process.platform === "win32";
const PORTS = [47300, 47420];
const CONTAINER = "magick-cookie-pg";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`\x1b[36m[dev:empty]\x1b[0m ${msg}`);
}

function logOk(msg) {
  console.log(`\x1b[32m[dev:empty]\x1b[0m ${msg}`);
}

function logErr(msg) {
  console.error(`\x1b[31m[dev:empty]\x1b[0m ${msg}`);
}

// ─── Kill ports ───────────────────────────────────────────────────────────────

function killPorts() {
  log("Libération des ports 47300 / 47420...");
  for (const port of PORTS) {
    try {
      if (isWindows) {
        const output = execSync(
          `netstat -ano | findstr :${port} | findstr LISTENING`,
          { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
        );
        const pids = new Set();
        for (const line of output.trim().split("\n")) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && pid !== "0") pids.add(pid);
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: "pipe" });
            log(`  Port ${port} libéré (PID ${pid})`);
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
            log(`  Port ${port} libéré (PID ${pid})`);
          } catch {}
        }
      }
    } catch {
      // Aucun process sur ce port — c'est bien
    }
  }
}

// ─── Docker DB ────────────────────────────────────────────────────────────────

function isContainerRunning() {
  try {
    const status = execSync(
      `docker inspect -f "{{.State.Status}}" ${CONTAINER}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    return status === "running";
  } catch {
    return false;
  }
}

function getContainerStatus() {
  try {
    return execSync(
      `docker inspect -f "{{.State.Status}}" ${CONTAINER}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  } catch {
    return null;
  }
}

function isDbReady() {
  try {
    execSync(`docker exec ${CONTAINER} pg_isready -U postgres`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDb() {
  if (!isContainerRunning()) {
    log("Démarrage du container PostgreSQL...");
    const status = getContainerStatus();
    if (status !== null) {
      execSync(`docker start ${CONTAINER}`, { stdio: "inherit" });
    } else {
      execSync("docker compose up -d pg", { stdio: "inherit" });
    }
  }

  for (let i = 0; i < 30; i++) {
    if (isDbReady()) {
      logOk("Container PostgreSQL prêt.");
      return;
    }
    await sleep(1000);
  }

  logErr("PostgreSQL non disponible après 30s. Abandonne.");
  process.exit(1);
}

// ─── Shutdown ─────────────────────────────────────────────────────────────────

let shuttingDown = false;

function shutdown(commands) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Arrêt...");
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
  log("Arrêté.");
  process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("\x1b[1m\x1b[36m▸ Magick Cookie — mode DB vide\x1b[0m");
  console.log(`\x1b[2m  DB test : ${TEST_DB_URL}\x1b[0m`);
  console.log();

  killPorts();
  await ensureDb();

  // Injecter la DB de test dans l'environnement AVANT le reset et le lancement
  process.env.DATABASE_URL = TEST_DB_URL;

  // Reset complet de la DB de test (drop + migrate → DB vide)
  log("Reset de la DB de test...");
  try {
    execSync("bun run --filter api db:reset", {
      stdio: "inherit",
      env: process.env, // hérite DATABASE_URL = TEST_DB_URL
    });
  } catch (e) {
    logErr("Échec du reset DB. Vérifier que PostgreSQL est accessible.");
    process.exit(1);
  }
  logOk("DB de test prête (vide + migrée).\n");

  // Lancer API (avec DB de test) + Desktop en parallèle
  log("Lancement API + Desktop...\n");

  const { commands, result } = concurrently(
    [
      {
        command: "bun run api:dev",
        name: "api",
        prefixColor: "cyan",
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      },
      {
        command: "bun run desktop:dev",
        name: "desktop",
        prefixColor: "green",
      },
    ],
    { killOthersOn: ["failure", "success"] },
  );

  process.on("SIGINT", () => shutdown(commands));
  process.on("SIGTERM", () => shutdown(commands));

  result.then(
    () => { killPorts(); process.exit(0); },
    () => { killPorts(); process.exit(1); },
  );
}

main().catch((err) => {
  logErr(`Erreur fatale : ${err.message}`);
  process.exit(1);
});
