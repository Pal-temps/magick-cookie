CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(255) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  category VARCHAR(100),
  site_url VARCHAR(1000),
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rss_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  guid VARCHAR(1000) NOT NULL,
  title VARCHAR(1000),
  link VARCHAR(1000),
  description TEXT,
  content TEXT,
  author VARCHAR(500),
  published_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rss_articles_feed_published ON rss_articles(feed_id, published_at DESC);
CREATE INDEX idx_rss_articles_unread ON rss_articles(feed_id, is_read);
CREATE UNIQUE INDEX idx_rss_articles_feed_guid ON rss_articles(feed_id, guid);
