-- Flux: universal triage system (replaces task_triage)
-- Supports tasks, emails, and RSS articles

CREATE TABLE IF NOT EXISTS "flux_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" varchar(20) NOT NULL,
  "entity_id" uuid NOT NULL,
  "flux_status" varchar(50) NOT NULL,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_flux_entity" ON "flux_items" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_flux_status" ON "flux_items" ("flux_status");
CREATE INDEX IF NOT EXISTS "idx_flux_type_status" ON "flux_items" ("entity_type", "flux_status");

-- Migrate existing task triage data
INSERT INTO "flux_items" ("id", "entity_type", "entity_id", "flux_status", "decided_at", "created_at", "updated_at")
SELECT "id", 'task', "task_id", "triage_status", "triaged_at", "created_at", "updated_at"
FROM "task_triage"
ON CONFLICT DO NOTHING;

-- Drop old table
DROP TABLE IF EXISTS "task_triage";
