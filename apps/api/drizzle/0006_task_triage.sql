CREATE TABLE IF NOT EXISTS "task_triage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clickup_task_id" varchar(255) NOT NULL UNIQUE,
  "triage_status" varchar(50) NOT NULL,
  "triaged_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
