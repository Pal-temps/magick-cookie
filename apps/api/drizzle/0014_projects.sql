CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "color" varchar(7) DEFAULT '#6c5ce7' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "timer_sessions" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;
