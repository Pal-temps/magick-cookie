import postgres from "postgres";
import { config } from "../config";

const sql = postgres(config.databaseUrl);

async function drop() {
  console.log("Dropping all tables...");

  // Drop all tables in public schema
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `;

  // Drop drizzle migration tracking
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

  // Drop custom enums
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `;

  console.log("All tables, enums, and migration history dropped.");
  await sql.end();
}

drop().catch((err) => {
  console.error("Drop failed:", err);
  process.exit(1);
});
