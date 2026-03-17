CREATE TABLE IF NOT EXISTS "github_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "username" varchar(255) NOT NULL,
  "repos" text NOT NULL DEFAULT '[]',
  "poll_interval_seconds" integer NOT NULL DEFAULT 300,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "github_prs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pr_number" integer NOT NULL,
  "repo" varchar(500) NOT NULL,
  "title" varchar(1000) NOT NULL,
  "state" varchar(50) NOT NULL,
  "draft" boolean NOT NULL DEFAULT false,
  "author" varchar(255) NOT NULL,
  "url" varchar(1000) NOT NULL,
  "review_requested" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("repo", "pr_number")
);
