CREATE TABLE bookmark_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value VARCHAR(30) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookmarks ADD COLUMN category VARCHAR(30) NOT NULL DEFAULT 'none';

INSERT INTO bookmark_categories (value, label, sort_order) VALUES
  ('design', 'Design', 1),
  ('composants', 'Composants', 2),
  ('opensource', 'Open Source', 3),
  ('documentation', 'Documentation', 4),
  ('devops', 'DevOps', 5),
  ('outils', 'Outils', 6),
  ('veille', 'Veille', 7),
  ('api', 'API', 8);
