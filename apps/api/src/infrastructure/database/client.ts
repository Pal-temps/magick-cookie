import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { config } from "../../config";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const dbPath = resolve(config.databasePath);
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
export type Database = typeof db;

// Auto-migrate at startup — safe to call on every boot (Drizzle tracks applied migrations)
const migrationsFolder = resolve(process.env.MIGRATIONS_PATH ?? "./drizzle");
migrate(db, { migrationsFolder });
console.log(`[db] Ready — ${dbPath}`);
