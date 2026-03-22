# RSS

> Statut : **Done** — Lecteur RSS, catalogue FR/EN, digest IA quotidien, retention auto, extraction Readability.

Lecteur RSS integre pour suivre blogs, actus tech, changelogs sans quitter l'app.

## Architecture

```
api/src/
├── domain/rss/
│   ├── rss-feed.entity.ts            # RssFeed { url, title, siteUrl, lastFetchedAt, failCount, disabled }
│   ├── rss-article.entity.ts         # RssArticle { feedId, guid, title, link, content, pubDate, isRead }
│   ├── rss-feed.repository.ts
│   └── rss-article.repository.ts
├── application/rss/
│   └── rss.service.ts                # CRUD + sync + digest + retention
├── infrastructure/
│   ├── adapters/
│   │   └── rss-parser.adapter.ts     # npm rss-parser
│   └── repositories/
│       ├── rss-feed.repository.impl.ts
│       └── rss-article.repository.impl.ts

desktop/src/
├── application/stores/rssStore.ts
└── ui/components/rss/
    └── RssView.tsx                    # Two-column: sidebar feeds + article list
```

## API

```
GET    /api/rss/feeds                  # Liste des feeds
POST   /api/rss/feeds                  # Ajouter un feed (+ sync immediate)
PUT    /api/rss/feeds/:id              # Modifier
DELETE /api/rss/feeds/:id              # Supprimer
GET    /api/rss/feeds/:id/articles     # Articles d'un feed
GET    /api/rss/articles               # Tous les articles (filtres)
PUT    /api/rss/articles/:id           # Marquer lu/non lu
POST   /api/rss/feeds/sync             # Forcer sync manuel

GET    /api/rss-articles/digest        # Digest IA (cache)
POST   /api/rss-articles/digest        # Forcer generation digest
GET    /api/rss-articles/unread-counts  # Comptages non-lus par feed
```

## Fonctionnalites

### Sync & parsing
- Job toutes les 15 minutes via `rss-parser`
- Deduplication par `guid` (fallback `link`)
- XML sanitization : unescaped `&` → `&amp;` avec fallback fetch+sanitize+parseString
- Extraction contenu complet via **Readability** (article entier, pas juste le snippet)
- Timeout fetch configurable

### Resilience
- Auto-disable feeds apres **3 echecs consecutifs** (compteur reset on success)
- Badge rouge "OFF" dans la sidebar, clic pour reactiver
- Feeds desactives affiches en barre

### Catalogue
- Feeds pre-configures FR et EN (tech, dev, IA, blogs)
- Sections collapsibles, compact rows
- Auto-sync immediate apres ajout

### Retention
- Auto-cleanup des articles anciens
- Duree configurable dans les settings UI

### Badges non-lus
- `countUnreadPerFeed()` — requete GROUP BY
- Badges visibles sur **tous** les feeds (pas seulement l'actif)
- Contraste : fond accent + texte blanc bold

### Digest IA quotidien
- `LlmService.generateRssDigest()` — prompt structure pour triage articles
- Fetch articles non-lus 24h, appel LLM, digest structure (resume, highlights, thematiques)
- Job auto a 7h, cache memoire, check toutes les 5min
- Cap a 30 articles, descriptions trimees, timeout 120s
- Force JSON mode pour output structure
- Extraction JSON depuis reponses markdown-wrapped
- Auto-save en `.md` dans `_digests-rss/` (vault Notes)
- Routine target `"rss-digest"` disponible
