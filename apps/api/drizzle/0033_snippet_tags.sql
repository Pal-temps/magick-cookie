-- Replace snippet category (single string) with tags (JSON array)
ALTER TABLE "snippets" ADD COLUMN "tags" text DEFAULT '[]' NOT NULL;

-- Migrate existing category values into tags array
UPDATE "snippets" SET "tags" = CASE
  WHEN "category" = 'none' OR "category" = '' THEN '[]'
  ELSE '["' || "category" || '"]'
END;

-- Drop old category column
ALTER TABLE "snippets" DROP COLUMN "category";

-- Drop snippet_categories table
DROP TABLE IF EXISTS "snippet_categories";
