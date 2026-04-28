---
name: triage_inbox
description: Trie la boite de reception (emails non lus → categorie + flux). Stoppe avant les actions destructives.
trigger: manual
tools_required: [get_unread_email_count, classify_email, email_mark_read, email_star, email_move, set_flux, notes_create]
parameters:
  - name: max_emails
    type: number
    description: Nombre maximum d'emails a trier en une passe
    default: 20
  - name: archive_newsletters
    type: boolean
    description: Si true, deplace automatiquement les newsletters classifiees vers le dossier 'Newsletters'
    default: false
---

## Objectif

Tu vas traiter jusqu'a {{max_emails}} emails non lus dans la boite de reception et leur attribuer une categorie + un statut Flux.

## Sequence

1. **Inventaire** — appelle `get_unread_email_count`. Si 0, dis a l'utilisateur "Boite vide ✅" et arrete-toi.

2. **Liste les emails recents** — utilise `get_priority_items` avec `entityType: "email"` pour voir ce qui est deja priorise. Tu ne touches PAS a ces emails (ils sont deja deCides).

3. **Pour chaque email non lu (jusqu'a {{max_emails}})** :
   - Appelle `classify_email` avec son ID. Reutilise `cached: true` si la classification existe deja.
   - Selon la classification :
     - `action_requise` → marque-le `set_flux({ status: "priority" })` et `email_star({ isStarred: true })`.
     - `facture` → `set_flux({ status: "later" })` (pour traiter plus tard) + `email_star`.
     - `personnel` → laisser tel quel, juste classifier.
     - `notification` → `email_mark_read` (lecture passive ok).
     - `newsletter` → si `archive_newsletters=true`, `email_move({ targetFolder: "Newsletters" })`. Sinon `email_mark_read`.
     - `autre` → ne fais rien, laisse a l'utilisateur.

4. **Capture les decisions importantes** — si tu detectes 3+ emails `action_requise`, cree une note recapitulative avec `notes_create({ path: "triage_<date>.md" })` listant les sujets + senders.

## Rapport final

Pour chaque email traite, indique :
- Sender + sujet (tronque a 60 caracteres)
- Classification appliquee
- Action prise (star/mark_read/move/flux=...)

Termine par un compteur global :

> Triage termine : N emails traites, X marques comme prioritaires, Y archives, Z laisses tel quels.

## Garde-fous

- Ne supprime JAMAIS un email automatiquement (pas de `email_delete`, pas de `email_bulk_delete`).
- Si `email_move` echoue (dossier inexistant), arrete-toi et demande a l'utilisateur de creer le dossier.
- Si `classify_email` retourne `{ error: "LLM non configure" }`, abandonne le triage et explique a l'utilisateur que la classification a besoin d'un LLM.
