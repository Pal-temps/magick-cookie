CREATE TABLE bookmark_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value VARCHAR(30) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default tags
INSERT INTO bookmark_tags (value, label, sort_order) VALUES
  ('todo', 'A faire', 1),
  ('toread', 'A lire', 2),
  ('tocheck', 'A verifier', 3),
  ('towatch', 'A regarder', 4),
  ('reference', 'Reference', 5),
  ('inspiration', 'Inspiration', 6);
