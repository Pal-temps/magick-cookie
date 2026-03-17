-- Create tasks table
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "external_id" varchar(255),
  "source" varchar(50) NOT NULL DEFAULT 'manual',
  "title" varchar(500) NOT NULL,
  "description" text,
  "status" varchar(255) NOT NULL DEFAULT 'open',
  "priority" varchar(50),
  "url" varchar(1000),
  "labels" text NOT NULL DEFAULT '[]',
  "assignees" text NOT NULL DEFAULT '[]',
  "due_date" timestamp with time zone,
  "start_date" timestamp with time zone,
  "metadata" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tasks_external_source" ON "tasks" ("external_id", "source");

-- Migrate clickup_unscheduled_tasks -> tasks
INSERT INTO tasks (external_id, source, title, description, status, priority, url, labels, assignees, created_at, updated_at)
SELECT clickup_task_id, 'clickup', name, description, status, priority, url,
       json_build_array(list_name)::text, assignees, created_at, updated_at
FROM clickup_unscheduled_tasks
ON CONFLICT DO NOTHING;

-- Migrate events with clickup_task_id (scheduled tasks)
INSERT INTO tasks (external_id, source, title, status, url, created_at, updated_at)
SELECT e.clickup_task_id, 'clickup', e.title, 'scheduled', e.location, e.created_at, e.updated_at
FROM events e
WHERE e.clickup_task_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.external_id = e.clickup_task_id AND t.source = 'clickup')
ON CONFLICT DO NOTHING;

-- Add task_id to events, populate from tasks, drop clickup_task_id
ALTER TABLE events ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
UPDATE events SET task_id = t.id FROM tasks t WHERE t.external_id = events.clickup_task_id AND t.source = 'clickup';
ALTER TABLE events DROP COLUMN clickup_task_id;

-- Migrate task_triage from clickup_task_id to task_id
ALTER TABLE task_triage ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE CASCADE;
UPDATE task_triage SET task_id = t.id FROM tasks t WHERE t.external_id = task_triage.clickup_task_id AND t.source = 'clickup';
DELETE FROM task_triage WHERE task_id IS NULL;
ALTER TABLE task_triage ALTER COLUMN task_id SET NOT NULL;
ALTER TABLE task_triage ADD CONSTRAINT task_triage_task_id_unique UNIQUE(task_id);
ALTER TABLE task_triage DROP COLUMN clickup_task_id;

-- Drop old table
DROP TABLE IF EXISTS clickup_unscheduled_tasks;
