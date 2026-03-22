# Dev Tools

> Statut : **Done** — Snippets, CI/CD, env checker, changelog, kanban, multi-connector, bookmarks.

Features orientees productivite developpeur.

## Kanban Board

- Vue visuelle des taches en colonnes drag & drop (Backlog → En cours → Done → Archive)
- Cartes avec titre, priorite, labels
- Filtre par projet
- Reutilise `tasks` + `task_triage` (statut triage = colonnes)
- `KanbanView.tsx` + batch update statuts

## Snippets / Code Clipboard

- Stocker bouts de code, commandes, templates reutilisables
- Syntax highlighting, categories dynamiques (DB), tags, recherche
- Accessible via command palette (`snip:` prefix)

### DB
- `snippets` (id, title, content, language, category, tags, is_favorite)
- `snippet_categories` (id, value, label, sort_order)

## CI/CD Dashboard (GitHub Actions)

- Statut des pipelines GitHub Actions en temps reel
- Derniers runs, statut (success/failure/running), lien vers le run
- Widget dashboard `CiCdWidget.tsx`
- Reutilise le token GitHub existant

## Environment Checker

- Statut des services locaux (Docker, PostgreSQL, API health, ports)
- Dashboard sante de l'environnement dev
- `EnvWidget.tsx` + checks via Tauri (commandes Rust)

## Changelog Generator

- Scanner des repos git (GitScanService) + LLM
- Selectionner repo, plage de dates
- Changelog structure : features, fixes, breaking changes

## Multi-Connector (GitHub, GitLab, ClickUp)

- Table generique `connector_configs`
- GitHub : Issues + PRs
- GitLab : Issues + Boards
- ClickUp : taches
- Tabs filtrage, guide setup, settings dediees

## GitHub PR Watcher

- `GitHubWidget.tsx` dans le dashboard
- `GitHubSettings.tsx` : config repos + token
- PRs ouvertes, reviews en attente
- Pattern repository : `GitHubConfigRepository` + `GitHubPRRepository`

## Bookmarks

- CRUD API + sidebar favoris
- Command palette `go:` prefix
- Tags dynamiques en DB (`bookmark_tags`)
- Categories dynamiques en DB (`bookmark_categories`, 8 defaults)
- Vault sync : export auto `_bookmarks/bookmarks.md`

## VPS Monitoring

- `VpsWidget.tsx` + `VpsView.tsx` + `VpsSettings.tsx`
- Sante serveurs (health checks)

## Projects

- CRUD API
- Lien avec timer sessions (`projectId`)
- Analytics time-by-project
- `ProjectSettings.tsx`

## Smart Reminders

- Alertes : taches stale, untriaged, unread emails
- Polling toutes les heures
