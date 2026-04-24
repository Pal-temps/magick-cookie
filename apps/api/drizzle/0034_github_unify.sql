-- P1 (AI integration plan): unify GitHub config into connector_configs,
-- rename github_prs → synced_issues with generic (source, external_id).

-- 1) Backfill connector_configs from github_config (only if no github connector row yet).
INSERT INTO "connector_configs" ("type", "token", "settings", "enabled")
SELECT
  'github',
  "token",
  json_build_object(
    'username', "username",
    'repos', CASE
      WHEN "repos" IS NULL OR "repos" = '' THEN '[]'::json
      ELSE "repos"::json
    END,
    'pollIntervalSeconds', "poll_interval_seconds",
    'syncIssues', true,
    'syncPRs', false
  )::text,
  true
FROM "github_config"
WHERE NOT EXISTS (SELECT 1 FROM "connector_configs" WHERE "type" = 'github')
LIMIT 1;

-- 2) Drop legacy github_config table.
DROP TABLE IF EXISTS "github_config";

-- 3) Rename github_prs → synced_issues.
ALTER TABLE "github_prs" RENAME TO "synced_issues";

-- 4) Add generic columns with sensible defaults, then backfill and lock down.
ALTER TABLE "synced_issues" ADD COLUMN IF NOT EXISTS "source" varchar(50) NOT NULL DEFAULT 'github';
ALTER TABLE "synced_issues" ADD COLUMN IF NOT EXISTS "external_id" varchar(500);

UPDATE "synced_issues"
SET "external_id" = "repo" || '#' || "pr_number"
WHERE "external_id" IS NULL;

ALTER TABLE "synced_issues" ALTER COLUMN "external_id" SET NOT NULL;

-- 5) Swap the unique index from (repo, pr_number) to (source, external_id).
DROP INDEX IF EXISTS "idx_github_prs_repo_number";
CREATE UNIQUE INDEX IF NOT EXISTS "idx_synced_issues_source_external_id"
  ON "synced_issues" ("source", "external_id");
