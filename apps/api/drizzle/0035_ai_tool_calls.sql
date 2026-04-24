-- P2 (AI integration plan): audit trail for agent tool invocations.
-- Every tool dispatched by the agent is recorded here so the upcoming
-- "AI Activity" dashboard (P6) can report on latency, cost and failures.

CREATE TABLE IF NOT EXISTS "ai_tool_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "session_id" varchar(255),
  "tool_name" varchar(100) NOT NULL,
  "permission_level" varchar(20) NOT NULL DEFAULT 'auto',
  "args" text NOT NULL DEFAULT '{}',
  "result" text,
  "error_message" text,
  "status" varchar(20) NOT NULL,
  "duration_ms" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ai_tool_calls_conversation" ON "ai_tool_calls" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_tool_calls_tool" ON "ai_tool_calls" ("tool_name", "created_at");
