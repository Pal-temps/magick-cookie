-- Replace snippet category (single string) with tags (JSON array).
-- NOTE: destructive — the `category` column is dropped after backfill. Take a DB dump before
-- applying if you need a rollback path.

BEGIN;

ALTER TABLE "snippets" ADD COLUMN IF NOT EXISTS "tags" text DEFAULT '[]' NOT NULL;

-- Migrate existing category values into a JSON array. Using to_jsonb(ARRAY[...])::text ensures
-- that any quotes or backslashes inside the category value are escaped correctly — the earlier
-- implementation (`'["' || "category" || '"]'`) produced invalid JSON for categories containing
-- a double quote.
UPDATE "snippets"
SET "tags" = CASE
  WHEN "category" IS NULL OR "category" = '' OR "category" = 'none' THEN '[]'
  ELSE to_jsonb(ARRAY["category"])::text
END
WHERE "tags" = '[]';

ALTER TABLE "snippets" DROP COLUMN IF EXISTS "category";

DROP TABLE IF EXISTS "snippet_categories";

COMMIT;
