---
name: "✅ Validation de feature / Feature validation"
about: "Valider qu'une feature est prête pour la v1 — Validate a feature for v1 release"
title: "[VALIDATION] "
labels: validation
assignees: ""
---

> 🇫🇷 Remplissez en français **ou** 🇬🇧 Fill in English

## Objectif / Goal

<!-- FR: Décrire ce qui doit être validé et pourquoi -->
<!-- EN: Describe what needs to be validated and why -->

## Phase 1 — Tests automatisés / Automated tests

<!-- FR: Lister les fichiers de tests à passer en vert avant toute validation manuelle -->
<!-- EN: List the test files that must be green before any manual validation -->

- [ ] `bun test` passe sur les fichiers du module / passes on module files
- [ ] 0 erreur TypeScript sur les fichiers modifiés / 0 TypeScript errors on modified files

## Phase 2 — Validation backend (API)

<!-- FR: Tester les endpoints API directement, indépendamment du frontend -->
<!-- EN: Test API endpoints directly, independently from the frontend -->

- [ ] Routes GET → 200 avec la bonne structure / with correct structure
- [ ] Routes POST avec body valide → 201 / with valid body → 201
- [ ] Routes POST avec body invalide → 400 / with invalid body → 400
- [ ] Route avec ID inexistant → 404

## Phase 3 — Setup & préconditions / Preconditions

<!-- FR: Ce qu'il faut avoir configuré pour tester -->
<!-- EN: What needs to be configured to test -->

- [ ] App lancée / App running (`bun run dev`)
- [ ] Vault déverrouillé / Vault unlocked

## Phase 4 — Happy path

<!-- FR: Les étapes principales du scénario nominal, une par une -->
<!-- EN: Main steps of the nominal scenario, one by one -->

- [ ] 
- [ ] 
- [ ] 

## Phase 5 — Edge cases / Cas limites

<!-- FR: Scénarios limites : réseau absent, champs vides, actions rapides -->
<!-- EN: Edge cases: no network, empty fields, rapid actions -->

- [ ] Comportement si réseau absent / Behavior with no network
- [ ] Champ vide ou valeur invalide / Empty field or invalid value
- [ ] Action rapide / répétée (double-clic, spam) / Rapid or repeated action

## Phase 6 — Régression visuelle / Visual regression

- [ ] Thème light — aucun artefact visuel / no visual artifacts
- [ ] Thème dark — aucun artefact visuel / no visual artifacts
- [ ] Aucune erreur dans la console (F12) / No console errors (F12)

## Phase 7 — Documentation wiki

- [ ] Créer la page wiki `Feature-[Nom]` / Create wiki page `Feature-[Name]`
- [ ] Utiliser le template `.github/WIKI_TEMPLATES/feature-validation.md`
- [ ] Statut "✅ Validée le [date]" renseigné / Status "✅ Validated on [date]" filled in
- [ ] URL de la page wiki ajoutée en commentaire de ce ticket / Wiki page URL added as comment

## ✅ Done quand / Done when

<!-- FR: Définir précisément ce qui signifie "validé" pour cette feature -->
<!-- EN: Define precisely what "validated" means for this feature -->

Tous les checks cochés, 0 erreur console, tests automatisés verts, page wiki créée.
All checks ticked, 0 console errors, automated tests green, wiki page created.
