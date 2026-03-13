# Spec Mobile — Calendriers

## Endpoints API

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/calendars` | Lister tous les calendriers |
| GET | `/api/calendars/:id` | Detail d'un calendrier |
| POST | `/api/calendars` | Creer un calendrier |
| PUT | `/api/calendars/:id` | Modifier un calendrier |
| DELETE | `/api/calendars/:id` | Supprimer un calendrier (cascade events + reminders) |

## Modele de donnees

```typescript
interface Calendar {
  id: string;           // UUID
  name: string;         // max 255 chars
  description: string | null;
  color: string;        // hex #RRGGBB, default #6c5ce7
  isDefault: boolean;
  createdAt: string;    // ISO 8601
  updatedAt: string;
}
```

## Comportement attendu

- L'utilisateur peut creer plusieurs calendriers avec des couleurs differentes
- Un calendrier peut etre masque/affiche (toggle local, pas d'API)
- Suppression = confirmation obligatoire (supprime aussi tous les events)
- Couleurs disponibles : violet `#6c5ce7`, bleu `#0984e3`, vert `#00b894`, orange `#fdcb6e`, rose `#fd79a8`, rouge `#d63031`

## Particularites UX mobile

- Liste des calendriers dans un drawer lateral (swipe depuis le bord gauche)
- Tap long sur un calendrier = options (modifier, supprimer)
- Color picker simplifie (grille de 6 couleurs predefinies)
- Toggle de visibilite par simple tap sur le rond de couleur

## Format reponses API

```json
// Succes
{ "data": Calendar | Calendar[] }

// Erreur
{ "error": "message", "details": ... }
```
