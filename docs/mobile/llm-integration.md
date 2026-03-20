# Integration IA (LLM local & API cloud) — Mobile Spec

## Objectif
Connecter un modele de langage a l'app pour les fonctionnalites IA (resume d'emails, etc.). L'utilisateur choisit entre un LLM local (aucune donnee envoyee a l'exterieur) ou une API cloud (cle API requise).

## Architecture

L'app mobile n'appelle jamais le LLM directement. Tout passe par l'API backend :

```
Mobile App → API Backend → LLM (local ou cloud)
```

Le backend gere :
- La configuration (mode, provider, URL, modele, cle API)
- Le routage vers le bon adapter selon le provider
- Les prompts systeme optimises

## API Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/llm/config` | Recuperer la config active |
| PUT | `/api/llm/config` | Modifier la config |
| POST | `/api/llm/test` | Tester la connexion au LLM |
| POST | `/api/llm/chat` | Envoyer des messages au LLM |
| POST | `/api/llm/generate-events` | Generer des evenements calendrier depuis un prompt |

### GET /api/llm/config

Retourne `null` si aucune config n'existe.

```typescript
interface LlmConfig {
  id: string;
  provider: string;        // voir table des providers ci-dessous
  baseUrl: string;          // ex: "http://localhost:11434" ou "https://api.openai.com"
  model: string;            // ex: "llama3.2", "gpt-4o-mini"
  apiKey: string | null;    // null pour les LLM locaux
  maxTokens: number;        // defaut: 2048
  temperature: number;      // defaut: 0.7
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### PUT /api/llm/config

Body :

```typescript
{
  provider: string;              // requis
  baseUrl: string;               // requis, doit etre une URL valide
  model: string;                 // requis
  apiKey?: string | null;        // requis pour les providers cloud
  maxTokens?: number;            // 1-32768, optionnel (defaut: 2048)
  temperature?: number;          // 0-2, optionnel (defaut: 0.7)
  enabled?: boolean;             // optionnel
}
```

Fait un upsert : met a jour la config existante ou en cree une nouvelle.

### POST /api/llm/test

Pas de body. Teste la connexion en envoyant "Say OK" au LLM.

```json
{ "data": { "success": true } }
```

### POST /api/llm/chat

Body :

```typescript
{
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
}
```

Reponse :

```json
{ "data": { "response": "Le texte genere par le LLM..." } }
```

## Providers supportes

### LLM locaux (aucune cle API)

| Provider ID | Label | Protocol | URL par defaut | Modele par defaut |
|-------------|-------|----------|----------------|-------------------|
| `ollama` | Ollama | `POST /api/chat` (natif) | `http://localhost:11434` | `llama3.2` |
| `lmstudio` | LM Studio | OpenAI-compatible | `http://localhost:1234` | `local-model` |

### API cloud (cle API requise)

| Provider ID | Label | Protocol | URL par defaut | Modele par defaut |
|-------------|-------|----------|----------------|-------------------|
| `openai` | OpenAI | OpenAI API | `https://api.openai.com` | `gpt-4o-mini` |
| `anthropic` | Anthropic | OpenAI-compatible | `https://api.anthropic.com` | `claude-sonnet-4-20250514` |
| `mistral` | Mistral AI | OpenAI-compatible | `https://api.mistral.ai` | `mistral-small-latest` |
| `groq` | Groq | OpenAI-compatible | `https://api.groq.com/openai` | `llama-3.3-70b-versatile` |
| `openai-compatible` | Autre | OpenAI-compatible | (configurable) | (configurable) |

Tous les providers cloud utilisent le format OpenAI-compatible (`POST /v1/chat/completions`).

## DB Schema

### llm_configs

| Colonne | Type | Contrainte |
|---------|------|-----------|
| id | uuid | PK |
| provider | varchar(50) | NOT NULL |
| base_url | varchar(500) | NOT NULL |
| model | varchar(255) | NOT NULL |
| api_key | text | nullable |
| max_tokens | integer | NOT NULL DEFAULT 2048 |
| temperature | varchar(10) | NOT NULL DEFAULT '0.7' |
| enabled | boolean | NOT NULL DEFAULT true |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

Migration : `drizzle/0008_llm_configs.sql`

## Affichage mobile — Ecran Parametres > IA

Accessible depuis : navigation principale → onglet "Parametres" (ou menu hamburger → "Parametres").

### Structure de l'ecran

L'ecran Parametres est une vue a part entiere (`viewMode = "settings"`) avec une sidebar de sections. La section "Intelligence artificielle" contient la configuration LLM.

### 1. Selecteur de mode

Toggle segmente en haut de l'ecran :

| Mode | Label | Description affichee |
|------|-------|----------------------|
| `local` | LLM Local | "Connectez un LLM tournant sur votre machine (aucune donnee envoyee a l'exterieur)" |
| `api` | API Cloud | "Utilisez une API cloud avec une cle API (les donnees sont envoyees au fournisseur)" |

Le changement de mode filtre les providers affiches et pre-selectionne le premier du mode.

### 2. Selecteur de fournisseur

Boutons horizontaux, filtres selon le mode selectionne :
- Mode local : Ollama, LM Studio
- Mode API : OpenAI, Anthropic, Mistral AI, Groq, Autre (OpenAI compatible)

La selection d'un provider pre-remplit l'URL et le modele par defaut.

### 3. Champs de configuration

| Champ | Type | Visible si | Placeholder |
|-------|------|-----------|-------------|
| Cle API | password | mode = `api` | Selon provider : "sk-...", "sk-ant-...", etc. |
| URL de base | text | toujours | Selon mode : "http://localhost:11434" ou "https://api.example.com" |
| Modele | text | toujours | Selon mode : "llama3.2" ou "gpt-4o-mini" |
| Max tokens | number | toujours (avance) | 2048 |
| Temperature | number (step 0.1) | toujours (avance) | 0.7 |

Textes d'aide sous les champs :
- Cle API : lien vers la console du provider ("Obtenez votre cle sur platform.openai.com")
- URL (mode local) : "Assurez-vous que Ollama est lance sur cette adresse"
- Modele (mode local, Ollama) : "Listez vos modeles avec : ollama list"

### 4. Actions

- **Bouton "Sauvegarder"** : `PUT /api/llm/config` → feedback "Sauvegarde" en vert pendant 2s
- **Bouton "Tester la connexion"** : `POST /api/llm/test` → "Connexion OK" (vert) ou "Echec de connexion" (rouge)

### 5. Encart "Configuration active"

Apres sauvegarde, affiche un encart recapitulatif :
- Fournisseur : nom du provider
- Modele : nom du modele
- URL : base URL
- Cle API : "configuree" ou "aucune"

### POST /api/llm/generate-events

Body :

```typescript
{
  prompt: string;   // requis, 1-2000 chars — ex: "Planifie ma journee de travail"
  date: string;     // requis — date de reference au format YYYY-MM-DD
}
```

Reponse :

```json
{
  "data": {
    "events": [
      {
        "title": "Reunion equipe",
        "startAt": "2026-03-19T09:00:00.000Z",
        "endAt": "2026-03-19T10:00:00.000Z",
        "description": null,
        "location": "Salle A",
        "isAllDay": false
      }
    ]
  }
}
```

Le LLM recoit un system prompt structure demandant du JSON strict. Le backend parse et valide la reponse. Si le LLM retourne du JSON invalide, un tableau vide est retourne.

### POST /api/rss-articles/digest

Genere un digest IA des flux RSS (articles non-lus des dernieres 24h).

- `GET` retourne le digest en cache (genere automatiquement a 7h)
- `POST` force la regeneration

Reponse :

```json
{
  "data": {
    "generatedAt": "2026-03-20T07:00:00.000Z",
    "totalUnread": 42,
    "highlights": [
      {
        "title": "Titre de l'article",
        "feedLabel": "Nom du feed",
        "reason": "Pourquoi c'est interessant",
        "link": "https://..."
      }
    ],
    "summary": "Resume global des tendances du jour.",
    "categories": [
      { "name": "Tech", "count": 15, "topArticle": "Meilleur article tech" }
    ]
  }
}
```

Le job backend genere automatiquement le digest a 7h chaque jour. Le desktop peut aussi forcer la generation via le bouton "Generer" dans la vue Digest.

## Utilisation par d'autres features

Le LLM est un service generique utilise par :
- **Resume email** (`POST /api/emails/:id/summarize`) — voir `email-shortcuts-ai-summary.md`
- **Generation d'events** (`POST /api/llm/generate-events`) — generer des evenements calendrier depuis un prompt libre
- **Digest RSS** (`POST /api/rss-articles/digest`) — triage et resume IA des flux RSS
- Classification automatique d'emails, generation de resume hebdomadaire narratif, suggestions de triage
