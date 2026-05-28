import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { config } from "../config";
import { mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH ?? config.databasePath;
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

const db = drizzle(sqlite);
const migrationsFolder = process.env.MIGRATIONS_PATH ?? "./drizzle";

await migrate(db, { migrationsFolder });
sqlite.close();
console.log(`[db] Migrations applied from ${migrationsFolder} to ${dbPath}`);
