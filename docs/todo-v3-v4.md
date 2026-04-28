# TODO v3/v4

## Tests manquants (post-P6.4 / devops 2e)

### gh CLI tools (`gh.tools.ts`)
- Test e2e : lancer avec gh installé via DevOps CLI settings, vérifier que `gh_run_list` retourne le bon JSON
- Test unitaire : mocker `Bun.spawn` pour vérifier les args passés au binaire
- Test : comportement quand gh n'est pas installé (doit retourner l'erreur "non installé")
- Test : comportement quand GH_TOKEN invalide (gh retourne exit code != 0)

### LlmBudgetService (`llm-budget.service.ts`)
- Test unitaire : `check()` passe quand under budget
- Test unitaire : `check()` throw quand over budget
- Test unitaire : reset automatique à minuit (mock `Date`)
- Test unitaire : `getLimit()` null quand user_preferences vide
- Test intégration : `LlmService.chat()` throw quand budget épuisé

### Undo tokens — pipeline tool-registry
- Test unitaire : `_undoToken` stripped du résultat retourné au LLM
- Test unitaire : `_undoToken` bien passé à `recordAudit`
- Test : `email_delete` avec email existant → undoToken non-null dans audit
- Test : `email_delete` avec email inexistant → undoToken null

## MCP Expansion (P6.5)
Packager les tools existants en serveur MCP local (Model Context Protocol Anthropic),
pour les exposer à Claude Desktop, Cursor, etc. en dehors de l'interface Magick Cookie.
Voir plan `docs/plans/ai-integration-2026-04-25.md` section P6.5.
