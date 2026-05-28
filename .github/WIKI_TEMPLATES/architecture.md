# Architecture : [Nom du composant / Component name]

> Copier ce fichier dans le wiki GitHub sous le nom `Architecture-[Nom].md`
> Copy this file to the GitHub wiki as `Architecture-[Name].md`

---

## Vue d'ensemble / Overview

<!-- FR: Description en 2-3 phrases du composant et de son rôle dans l'app -->
<!-- EN: 2-3 sentence description of the component and its role in the app -->

## Stack technique / Tech stack

| Couche / Layer | Technologie | Version |
|----------------|-------------|---------|
| Frontend | SolidJS + TypeScript | |
| Backend | Bun + Hono | |
| Base de données / Database | SQLite (Drizzle ORM) | |
| Desktop | Tauri v2 (Rust) | |

## Diagramme / Diagram

<!-- FR: Diagramme ASCII ou lien vers un schéma -->
<!-- EN: ASCII diagram or link to a schema -->

```
[Frontend SolidJS] ──HTTP──▶ [API Bun/Hono] ──▶ [SQLite]
        │                           │
        └──Tauri invoke──▶ [Rust backend]
```

## Fichiers clés / Key files

| Fichier / File | Rôle / Role |
|----------------|-------------|
| `apps/desktop/src/` | Frontend SolidJS |
| `apps/api/src/` | Backend Bun/Hono |
| `apps/desktop/src-tauri/src/` | Rust backend |

## Flux de données / Data flow

<!-- FR: Comment les données circulent entre les couches -->
<!-- EN: How data flows between layers -->

1. 
2. 
3. 

## Décisions architecturales / Architectural decisions

<!-- FR: Pourquoi ces choix techniques ? Alternatives envisagées ? -->
<!-- EN: Why these technical choices? Alternatives considered? -->

| Décision / Decision | Raison / Reason | Alternatives |
|--------------------|-----------------|--------------|
| | | |

## Dépendances externes / External dependencies

<!-- FR: APIs externes, services tiers, CLIs -->
<!-- EN: External APIs, third-party services, CLIs -->

| Dépendance / Dependency | Usage | Optionnel / Optional |
|------------------------|-------|----------------------|
| | | Oui/Non |

## Limitations & TODO

<!-- FR: Ce qui n'est pas encore fait ou qui pourrait être amélioré -->
<!-- EN: What isn't done yet or could be improved -->

- [ ] 

## Dernière mise à jour / Last updated

> Mis à jour le / Updated on : ___________  
> Par / By : ___________
