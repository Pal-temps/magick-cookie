CREATE TABLE IF NOT EXISTS "timer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" varchar(20) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"actual_seconds" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"completed" boolean NOT NULL DEFAULT true,
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wellness_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"interval_minutes" integer NOT NULL,
	"enabled" boolean NOT NULL DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wellness_configs_type_unique" UNIQUE("type")
);
