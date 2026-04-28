# Skills d'orchestration AI — templates

Phase 6.2 du plan d'integration AI : 3 templates de skills pretes a l'emploi
pour Cookia. Chaque skill est un fichier markdown avec un frontmatter YAML +
des instructions detaillees.

Les skills vivent dans le **vault utilisateur**, pas dans le repo (parce que
ce sont du **contenu** que l'utilisateur peut adapter, pas du code).

## Installation

Copie les fichiers de ce dossier dans ton vault Magick Cookie, sous `_ide/skills/` :

```bash
cp docs/skills-templates/*.md "$VAULT/_ide/skills/"
```

Le `SkillService` cote API les chargera automatiquement via le `skill_list` /
`skill_get` / `skill_prompt` tools. Cookia peut alors les invoquer en mode
`general` ou `triage` selon le skill.

## Templates fournis

| Skill | Trigger | Tools requis | Mode session conseille |
|---|---|---|---|
| [triage_inbox](triage_inbox.md) | manual | get_unread_email_count, classify_email, email_mark_read, email_star, email_move, set_flux | `triage` |
| [monday_brief](monday_brief.md) | manual (lundi) | generate_brief, get_unread_email_count, calendar_list, get_priority_items, notes_create | `brief` |
| [rss_digest_to_note](rss_digest_to_note.md) | manual / cron | rss_generate_digest, notes_create | `brief` |

## Convention de frontmatter

```yaml
---
name: nom_du_skill           # identifiant unique, utilise par skill_get / skill_prompt
description: courte phrase   # affichee dans skill_list
trigger: manual              # 'manual' ou 'auto' (auto = exposable a un futur scheduler)
tools_required: [t1, t2]     # liste des tools que la skill va appeler — pour aider le LLM
parameters:                  # parametres remplis a l'invocation
  - name: subdomain
    type: string
    description: ...
    default: app
---
```

## Conventions d'orchestration

- **Pas d'effet de bord muet** : chaque etape qui modifie quelque chose doit
  etre listee dans le rapport final.
- **Confirmation avant action irreversible** : meme si le tool est en `auto`,
  la skill doit verifier l'intention de l'utilisateur (ex: avant `email_move`).
- **Court-circuiter en cas d'erreur** : si un tool retourne `{ error }`, la
  skill arrete la sequence et resume ce qui a ete fait.
