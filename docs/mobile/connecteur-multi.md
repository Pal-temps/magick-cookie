# Spec Mobile — Multi-Connector Kanban (GitHub + GitLab + ClickUp)

## Vue d'ensemble

Le systeme de taches supporte desormais plusieurs connecteurs : ClickUp, GitHub (Issues + PRs) et GitLab (Issues + Boards). La configuration est centralisee dans une table `connector_configs`.

## Endpoints API

### Configuration des connecteurs

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/connector-configs` | Liste toutes les configs (tokens masques) |
| GET | `/api/connector-configs/:type` | Config specifique (clickup, github, gitlab) |
| PUT | `/api/connector-configs/:type` | Upsert config `{ token, settings }` |
| DELETE | `/api/connector-configs/:type` | Supprime la config |

### Synchronisation

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/connectors/clickup/sync` | Sync ClickUp → tasks |
| POST | `/api/connectors/github/sync` | Sync GitHub Issues/PRs → tasks |
| POST | `/api/connectors/gitlab/sync` | Sync GitLab Issues → tasks |

### Taches (avec filtre source)

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/tasks` | Toutes les taches |
| GET | `/api/tasks?source=github` | Taches d'une source specifique |
| GET | `/api/tasks/:id/detail` | Detail + commentaires (dispatch automatique par source) |

## Modeles

### ConnectorConfig

```typescript
interface ConnectorConfig {
  id: string;
  type: "clickup" | "github" | "gitlab";
  token: string;         // masque dans les reponses GET (4 premiers + ... + 4 derniers chars)
  settings: object;      // JSON specifique au type
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Settings JSON par type

**GitHub :**
```json
{
  "username": "mon-user",
  "repos": ["owner/repo1", "owner/repo2"],
  "syncIssues": true,
  "syncPRs": false
}
```

**GitLab :**
```json
{
  "baseUrl": "https://gitlab.com",
  "projectIds": [12345, 67890]
}
```

**ClickUp :**
```json
{}
```

### Task (etendu)

Le champ `source` peut desormais etre : `"clickup"` | `"github"` | `"gitlab"` | `"manual"`

ExternalId par source :
- ClickUp : `"abc123"` (ID ClickUp natif)
- GitHub : `"owner/repo#123"` (repo + numero issue/PR)
- GitLab : `"project:123#iid:456"` (ID projet + IID issue)

## Reponse sync

```json
{
  "data": {
    "eventsCreated": 3,
    "eventsUpdated": 1,
    "tasksUpserted": 12
  }
}
```

## Reponse detail

```json
{
  "data": {
    "description": "Contenu markdown de l'issue...",
    "comments": [
      {
        "id": "123",
        "commentText": "Mon commentaire",
        "user": { "username": "alice", "initials": "AL" },
        "date": "2026-03-19T10:00:00Z"
      }
    ]
  }
}
```

## Particularites UX mobile

### Tabs de filtrage

Barre horizontale en haut du kanban avec les onglets :
- **Tout** — toutes les taches melangees
- **ClickUp** — taches source "clickup" uniquement
- **GitHub** — taches source "github" uniquement
- **GitLab** — taches source "gitlab" uniquement
- **Manuel** — taches source "manual" uniquement

L'onglet actif filtre les taches affichees dans le kanban et change le bouton Sync.

### Guide de setup (onglet non configure)

Quand un onglet est selectionne mais le connecteur n'est pas configure, afficher un guide etape par etape :

**GitHub :**
1. Creer un Personal Access Token → bouton "Ouvrir GitHub Tokens" (lien externe)
2. Configurer dans les parametres → bouton "Ouvrir Parametres"
3. Renseigner token + username + repos
4. Activer Issues et/ou Pull Requests
5. Revenir et cliquer Sync

**GitLab :**
1. Creer un Personal Access Token (scope read_api) → bouton "Ouvrir GitLab Tokens"
2. Configurer dans les parametres → bouton "Ouvrir Parametres"
3. Renseigner token + URL de base + IDs projets
4. Revenir et cliquer Sync

**ClickUp :**
1. Generer un token API → bouton "Ouvrir ClickUp Apps"
2. Configurer dans les parametres → bouton "Ouvrir Parametres"
3. Renseigner le token
4. Revenir et cliquer Sync

### Icones source dans les cartes

Chaque carte du kanban affiche une icone source en bas a droite :
- ClickUp : clipboard
- GitHub : octopus
- GitLab : fox
- Manuel : pencil

### Detail dynamique

Le modal de detail affiche :
- Titre : "Tache GitHub" / "Tache GitLab" / "Tache ClickUp" / "Tache Manuelle"
- Description chargee depuis l'API externe (markdown)
- Commentaires/notes depuis l'API externe
- Bouton "Ouvrir dans {source}" (sauf manual) → ouvre l'URL dans le navigateur

### Settings Connecteurs

Ecran de parametres dedie avec une card par connecteur :
- **ClickUp** : token
- **GitHub** : token, username, repos (multi-input), toggles Issues/PRs
- **GitLab** : token, URL de base, IDs projets (multi-input)
- Actions : Sauvegarder, Tester la connexion, Supprimer

### Background sync

Les 3 connecteurs synchronisent en arriere-plan toutes les 5 minutes (configurable). Sur mobile, utiliser WorkManager pour le polling periodique.

## Calendriers dedies

Chaque connecteur cree un calendrier automatiquement :
- **ClickUp** : couleur `#7B68EE`
- **GitHub** : couleur `#24292e`
- **GitLab** : couleur `#fc6d26`

Les taches avec une date d'echeance (due_date ou milestone) sont creees comme events dans le calendrier correspondant.
