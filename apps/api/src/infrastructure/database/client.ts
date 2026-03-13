import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from "../../config";

const queryClient = postgres(config.databaseUrl);
export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
