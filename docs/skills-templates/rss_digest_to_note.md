---
name: rss_digest_to_note
description: Genere un digest RSS LLM (highlights + resume + categories) et l'archive dans le vault.
trigger: manual
tools_required: [rss_generate_digest, notes_create, rss_mark_all_read]
parameters:
  - name: vault_path
    type: string
    description: Chemin de la note (le {date} sera substitue par YYYY-MM-DD)
    default: _ide/digests/rss-{date}.md
  - name: mark_read
    type: boolean
    description: Marquer tous les articles comme lus apres l'archivage
    default: false
---

## Objectif

Tu archives le contenu interessant des flux RSS des 24 dernieres heures dans une note markdown lisible, et optionnellement tu vides la liste des non-lus.

## Sequence

1. **Genere le digest**
   - Appelle `rss_generate_digest` (sans param).
   - Le tool retourne `{ generatedAt, totalUnread, highlights[], summary, categories[] }`.

2. **Cas vide** — si `totalUnread === 0` :
   - Reponds "Aucun nouvel article dans les dernieres 24h." et arrete-toi.
   - Ne cree PAS de note vide.

3. **Construis le markdown**

```markdown
# Digest RSS — {date du jour}

> {summary genere par le LLM}

## Highlights

{Pour chaque highlight}
- **{title}** ({feedLabel}) — {reason}
  [Lien]({link})

## Categories

{Pour chaque categorie}
- {name} ({count} article{s} | top: {topArticle})

## Stats

- Total non-lus pris en compte : {totalUnread}
- Genere le : {generatedAt}
```

4. **Enregistre la note** — `notes_create({ path: "<vault_path>", body: <markdown>, frontmatter: { type: "rss-digest", date: "YYYY-MM-DD", count: <totalUnread> } })`.

5. **Optionnel** — si `mark_read=true`, appelle `rss_mark_all_read` une fois par flux RSS implique. (Tu peux extraire les `feedId` distincts depuis les highlights — chaque highlight a son `feedLabel` mais pas l'ID. Pour cette etape, tu peux dire a l'utilisateur "Veux-tu que je marque tous les articles comme lus ? Reponds 'oui' pour que je le fasse." plutot que d'agir d'office.)

## Rapport final

> Digest RSS du {date} enregistre dans `<chemin>`. {N} highlights identifies sur {totalUnread} articles non lus.

## Garde-fous

- Si `rss_generate_digest` retourne `{ error: "LLM service not configured" }`, demande a l'utilisateur de configurer un LLM dans Settings → LLM avant de relancer la skill.
- Ne marque PAS les articles comme lus sans confirmation explicite (`mark_read=true` ou reponse "oui" de l'utilisateur).
- Si `notes_create` echoue parce que le fichier existe deja, append un suffixe horaire (`-HHmm`) plutot qu'ecraser.
