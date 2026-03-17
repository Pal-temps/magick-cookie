# Raccourcis clavier Email & Resume IA — Mobile Spec

## Raccourcis clavier Email

### Objectif
Navigation et actions rapides dans la vue email, style Gmail. Sur mobile, ces raccourcis sont remplaces par des gestes et boutons d'action.

### Mapping Desktop → Mobile

| Desktop (clavier) | Action | Mobile (equivalent) |
|-------------------|--------|---------------------|
| `j` / `k` | Email suivant / precedent | Swipe haut/bas dans la liste |
| `Enter` | Ouvrir l'email | Tap sur l'email |
| `Escape` | Retour a la liste | Bouton retour Android / swipe back |
| `e` | Archiver | Swipe gauche sur l'email |
| `s` | Star / unstar | Tap sur l'etoile |
| `r` | Marquer lu / non lu | Menu contextuel (long press) |
| `Delete` | Supprimer | Swipe droite ou menu contextuel |
| `g` then `i` | Aller a Inbox | Tap onglet "Inbox" |
| `g` then `s` | Aller a Sent | Tap onglet "Envoyes" |

### Implementation cote store

Le store email expose :
- `focusedIndex: number` — index de l'email en surbrillance (utile desktop, optionnel mobile)
- `moveFocus(delta: number)` — deplace le focus de +1/-1 avec clamping aux bornes
- `selectFocused()` — ouvre l'email a `focusedIndex`
- `toggleReadStatus(id: string)` — bascule lu/non-lu (PATCH flags + update unreadCount)

### API utilisee

| Methode | Route | Description |
|---------|-------|-------------|
| PUT | `/api/emails/:id` | Mise a jour des flags (isRead, isStarred, isArchived) |
| DELETE | `/api/emails/:id` | Suppression |

Pas de nouvel endpoint — les raccourcis utilisent les memes routes que les actions manuelles.

---

## Resume email par IA

### Objectif
Bouton "Resumer" dans le detail d'un email. Envoie le contenu au LLM local configure et affiche un resume en 2-3 phrases.

### Pre-requis
- Feature LLM local configuree et active (voir `llm-integration.md`)
- L'email doit avoir du contenu (`bodyText` ou `bodyHtml`)

### API Endpoint

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/emails/:id/summarize` | Genere un resume via LLM |

### Requete
Pas de body necessaire — l'API recupere l'email par son id.

### Traitement backend
1. Recupere l'email via `emailService.getEmailById(id)`
2. Extrait le texte : `bodyText` en priorite, sinon strip HTML de `bodyHtml`
3. Strip HTML : `html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()`
4. Appelle `llmService.summarize(text, systemPrompt)`
5. Prompt systeme : `"Resume cet email en 2-3 phrases en francais. Extrais les actions requises s'il y en a."`

### Reponse

```json
{
  "data": {
    "summary": "L'expediteur confirme la reunion de vendredi a 14h. Il demande de preparer le rapport trimestriel avant jeudi. Action requise : envoyer le rapport."
  }
}
```

### Erreurs

| Code | Cas |
|------|-----|
| 400 | LLM non configure (`llmService` absent) |
| 400 | Email sans contenu |
| 404 | Email non trouve |
| 500 | Erreur LLM (timeout, modele indisponible) |

### Affichage mobile
- Bouton "Resumer" dans la toolbar du detail email
  - Visible seulement si LLM configure (verifier via `GET /api/llm/config`)
  - Etat loading : texte "..." + spinner
- Bandeau resume au-dessus du body email :
  - Fond violet clair (`rgba(99, 102, 241, 0.1)`)
  - Bordure gauche violette (`#6366f1`)
  - Label "Resume IA" en gras
  - Texte du resume en dessous
- Le resume est ephemere (pas stocke en DB, perdu si on change d'email)

### Signaux du store
- `emailSummary: string | null` — le resume genere
- `summaryLoading: boolean` — etat de chargement
- `summarizeEmail(id: string)` — appelle l'API, met a jour les signaux
- Le resume est reset a `null` quand on selectionne un autre email
