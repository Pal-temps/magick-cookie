# Specs Mobile — Index

Documentation des specifications pour l'application mobile Android (Kotlin).

## Ordre d'implementation recommande

1. **[calendriers.md](calendriers.md)** — CRUD calendriers + toggle visibilite
2. **[evenements.md](evenements.md)** — CRUD evenements + filtrage par date range
3. **[rappels.md](rappels.md)** — Systeme de rappels + notifications Android
4. **[desktop-calendrier-evenements.md](desktop-calendrier-evenements.md)** — Vues calendrier (mois/semaine/jour), EventCard, EventForm, multi-calendriers
5. **[desktop-rappels-vues.md](desktop-rappels-vues.md)** — Notifications Android avancees, vues semaine/jour adaptees mobile
6. **[connecteur-clickup.md](connecteur-clickup.md)** — Connecteur ClickUp : sync taches, taches sans date, indicateurs priorite
7. **[notes-sync-themes.md](notes-sync-themes.md)** — Notes vault, git sync, 3 themes (dark/light/cookie), responsive
8. **[dashboard-analytics-weekly-review.md](dashboard-analytics-weekly-review.md)** — Widget analytics agrege (7j/30j) + bilan hebdomadaire avec deltas
9. **[email-shortcuts-ai-summary.md](email-shortcuts-ai-summary.md)** — Gestes email (swipe archive/delete) + resume IA via LLM local
10. **[llm-integration.md](llm-integration.md)** — Configuration LLM local (Ollama/LM Studio), endpoints chat/test, DB schema
11. **[agent-chat-mobile.md](agent-chat-mobile.md)** — App agent mobile : chat intelligent + dashboard compact + notifications push (prerequis: Phase 1-2 agent done)
12. **[user-preferences-sync.md](user-preferences-sync.md)** — Preferences utilisateur centralisees + sync serveur (GET/PUT /api/user-preferences)
13. **[connecteur-multi.md](connecteur-multi.md)** — Multi-connecteur Kanban (GitHub Issues+PRs, GitLab Issues+Boards, ClickUp) : table connector_configs, tabs filtrage, guide setup, settings dediees

## API de reference

- Base URL : `http://<api-host>:47300/api`
- Format reponses : `{ data: T }` (succes) / `{ error: string }` (erreur)
- Toutes les dates en ISO 8601 avec timezone

## Stack mobile cible

- Kotlin + Jetpack Compose
- Retrofit pour les appels API
- Room pour le cache local (optionnel)
- WorkManager pour le polling des rappels
- Material 3 avec theme dark personnalise (memes couleurs que le desktop)
