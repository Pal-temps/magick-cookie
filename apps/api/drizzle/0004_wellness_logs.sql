CREATE TABLE IF NOT EXISTS "wellness_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"date" varchar(10) NOT NULL,
	"value" integer NOT NULL DEFAULT 0,
	"goal" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
