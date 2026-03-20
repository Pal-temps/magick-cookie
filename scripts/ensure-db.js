#!/usr/bin/env node
// Ensure the Postgres container is running and ready before proceeding
const { execSync } = require("child_process");

const CONTAINER = "magick-cookie-db";
const MAX_WAIT = 30; // seconds

function getContainerStatus() {
  try {
    return execSync(`docker inspect -f "{{.State.Status}}" ${CONTAINER}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null; // container doesn't exist
  }
}

function isContainerRunning() {
  return getContainerStatus() === "running";
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

async function main() {
  if (!isContainerRunning()) {
    console.log("Starting database container...");
    const status = getContainerStatus();
    if (status !== null) {
      // Container exists but is stopped/exited — just start it
      execSync(`docker start ${CONTAINER}`, { stdio: "inherit" });
    } else {
      // Container doesn't exist — create it via compose
      execSync("docker compose up -d db", { stdio: "inherit" });
    }
  }

  // Wait for DB to be ready
  for (let i = 0; i < MAX_WAIT; i++) {
    if (isDbReady()) {
      console.log("Database ready.");
      return;
    }
    await sleep(1000);
  }

  console.error(`Database not ready after ${MAX_WAIT}s`);
  process.exit(1);
}

main();
