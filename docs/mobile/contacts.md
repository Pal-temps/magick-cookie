# Contacts

## Description

Gestion d'une liste de contacts (comme un carnet d'adresses), avec date d'anniversaire optionnelle. Les contacts ayant une date d'anniversaire génèrent automatiquement des événements virtuels dans le calendrier.

## Modèle de données

### Table `contacts`
| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID | PK, auto-generated |
| name | varchar(255) | NOT NULL |
| birth_date | timestamp(tz) | nullable — si renseigné, génère un événement anniversaire |
| phone | varchar(50) | nullable |
| email | varchar(255) | nullable |
| notes | text | nullable |
| created_at | timestamp(tz) | default now |
| updated_at | timestamp(tz) | default now, auto-update |

## Endpoints API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/contacts` | Lister tous les contacts |
| GET | `/api/contacts/:id` | Détail d'un contact |
| POST | `/api/contacts` | Créer un contact |
| PUT | `/api/contacts/:id` | Modifier un contact |
| DELETE | `/api/contacts/:id` | Supprimer un contact |

### Body POST/PUT
```json
{
  "name": "Jean Dupont",
  "birthDate": "1990-05-15T00:00:00.000Z",
  "phone": "+33 6 12 34 56 78",
  "email": "jean@example.com",
  "notes": "Collègue de travail"
}
```

- `name` : obligatoire
- `birthDate` : optionnel (nullable), format ISO 8601
- `phone` : optionnel, max 50 caractères
- `email` : optionnel, validé comme email, max 255 caractères
- `notes` : optionnel

### Réponse
```json
{
  "data": {
    "id": "uuid",
    "name": "Jean Dupont",
    "birthDate": "1990-05-15T00:00:00.000Z",
    "phone": "+33 6 12 34 56 78",
    "email": "jean@example.com",
    "notes": "Collègue de travail",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

## Événements anniversaire (virtuels)

Les contacts ayant un `birthDate` non-null génèrent des événements virtuels côté client :
- ID : `birthday-{contactId}-{year}`
- Titre : `Anniversaire de {name} ({age} ans)`
- Toute la journée (`isAllDay: true`)
- Calendar ID : `"birthdays"` (virtuel)
- Flag `_isBirthday: true` pour filtrage source
- Badge : "AN" en rose `#fd79a8`

Ces événements ne sont PAS stockés en base. Ils sont calculés à la volée pour la plage de dates demandée.

## Filtrage source

Le filtre "Anniversaires" dans la sidebar contrôle la visibilité des événements anniversaire dans le calendrier (indépendant des filtres ClickUp et Personnel).

## UX Desktop (sidebar)

Section "Contacts" collapsible dans la sidebar :
- Badge avec le nombre total de contacts
- Liste des contacts avec nom + info secondaire (date anniversaire, téléphone ou email)
- Formulaire inline d'ajout rapide : nom (requis) + date anniversaire (optionnel) + téléphone + email sur la même ligne
- Suppression par bouton × au hover

## Particularités mobile

- Liste de contacts accessible depuis un onglet ou menu dédié
- Fiche contact avec tous les champs (nom, date anniversaire, téléphone, email, notes)
- Action rapide : appel / SMS / email depuis la fiche contact
- Possibilité d'importer depuis les contacts du téléphone (Android Contacts API)
- Notification push le jour de l'anniversaire (via le système de rappels existant ou notification locale)
- Gestes tactiles : swipe pour supprimer, tap pour éditer
