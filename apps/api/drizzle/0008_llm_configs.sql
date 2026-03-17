CREATE TABLE IF NOT EXISTS "llm_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(50) NOT NULL,
  "base_url" varchar(500) NOT NULL,
  "model" varchar(255) NOT NULL,
  "api_key" text,
  "max_tokens" integer NOT NULL DEFAULT 2048,
  "temperature" varchar(10) NOT NULL DEFAULT '0.7',
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
