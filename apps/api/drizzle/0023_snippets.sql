CREATE TABLE snippet_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value VARCHAR(30) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  language VARCHAR(50) NOT NULL DEFAULT 'text',
  category VARCHAR(30) NOT NULL DEFAULT 'none',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO snippet_categories (value, label, sort_order) VALUES
  ('bash', 'Bash / Shell', 1),
  ('javascript', 'JavaScript', 2),
  ('typescript', 'TypeScript', 3),
  ('sql', 'SQL', 4),
  ('docker', 'Docker', 5),
  ('git', 'Git', 6),
  ('css', 'CSS', 7),
  ('config', 'Configuration', 8);
