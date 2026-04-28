---
name: monday_brief
description: Genere le brief du lundi (semaine ecoulee + priorites + agenda + emails non traites) et l'enregistre dans le vault.
trigger: manual
tools_required: [generate_brief, get_unread_email_count, calendar_list, get_priority_items, get_weekly_review, notes_create]
parameters:
  - name: weeks_back
    type: number
    description: Combien de semaines en arriere pour le bilan (defaut 1 = la semaine derniere)
    default: 1
  - name: vault_path
    type: string
    description: Chemin vault de la note recap (date sera substituee si {date} present)
    default: _ide/briefs/monday-{date}.md
---

## Objectif

Tu rediges le brief du lundi : un recap markdown structure que l'utilisateur peut lire en 2 minutes pour calibrer sa semaine.

## Sequence

1. **Bilan de la semaine ecoulee**
   - Appelle `get_weekly_review` (sans param → semaine ISO courante).
   - Recupere total focus, sessions, top projets, wellness deltas.

2. **Brief structure**
   - Appelle `generate_brief` (sans param → aujourd'hui).
   - Recupere yesterday/today/blockers/git.

3. **Inbox snapshot**
   - `get_unread_email_count` pour le compteur global.
   - `get_priority_items({ entityType: "email" })` pour les emails dans Flux=priority.

4. **Agenda de la semaine**
   - `calendar_list({ from: <lundi>, to: <vendredi> })`.
   - Identifie les meetings cles, les conflits potentiels (events qui se chevauchent — utilise les `startAt`/`endAt`).

5. **Taches prioritaires**
   - `get_priority_items({ entityType: "task" })`.

## Format de la note

```markdown
# Brief du lundi — {date}

## La semaine derniere

{X}h de focus sur {N} sessions. Top projet : {projet}.
{deltas wellness vs semaine d'avant en %}

## Cette semaine

### Agenda
- Lundi : {meetings}
- ...

### A faire en priorite
1. {task1}
2. {task2}

### Inbox
{N} emails non lus dont {M} marques comme prioritaires.
{Si M > 0, lister les sujets}

## Blockers detectes

{Liste des events overdue + stale tasks remontes par generate_brief}
```

6. **Enregistre la note** — `notes_create({ path: "<vault_path avec {date} substituee par YYYY-MM-DD>", body: <markdown ci-dessus>, frontmatter: { type: "brief", week: "<ISO week>" } })`.

## Rapport final

Apres avoir cree la note, dis :

> Brief du lundi enregistre dans `<chemin>`. {Hooks principaux a regarder en priorite : ...}.

## Garde-fous

- Si `generate_brief` retourne une erreur LLM, fais un brief minimal a partir des donnees brutes (sans le texte narratif).
- N'envoie aucun email, ne modifie aucune tache. Le brief est strictement lecture + une seule ecriture (la note).
- Si `notes_create` retourne `Note already exists`, append `-2`, `-3` au nom de fichier au lieu d'ecraser.
