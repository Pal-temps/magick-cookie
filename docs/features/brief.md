# Brief quotidien

> Statut : **Done** — Generation IA, git scan, templates customisables.

Resume quotidien en 3 sections (hier, aujourd'hui, blocages) genere par le LLM a partir des donnees de l'app.

## Architecture

```
api/src/
├── application/brief/
│   └── brief.service.ts              # Collecte donnees + generation LLM
├── application/git/
│   └── git-scan.service.ts           # Scan repos git locaux (commits 24h)
├── infrastructure/adapters/
│   └── git-exec.adapter.ts           # GitScanPort implementation
├── presentation/routes/
│   └── brief.routes.ts               # GET /api/brief/generate

desktop/src/
├── application/stores/analyticsStore.ts  # Signals brief
└── ui/components/dashboard/
    ├── BriefView.tsx                  # Vue du brief
    └── BriefSettings.tsx              # Templates + presets
```

## API

```
GET /api/brief/generate?date=2026-03-17   # Date optionnelle (defaut: aujourd'hui)
```

**Reponse :**
```typescript
interface BriefResponse {
  date: string;
  rawData: BriefRawData;    // donnees brutes collectees
  brief: string;             // texte genere par le LLM
}
```

## Donnees collectees

| Section | Source | Donnees |
|---------|--------|---------|
| **Hier** | timer_sessions | Sessions focus avec labels et durees |
| | events | Reunions d'hier |
| | task_triage | Taches triees hier |
| | git repos | Commits des dernieres 24h (GitScanService) |
| **Aujourd'hui** | events | Reunions du jour |
| | tasks + triage | Taches prioritaires |
| | emails | Nombre de non-lus |
| **Blocages** | task_triage | Taches en "priority" depuis > 3 jours |
| | events | Events passes non faits |

## Fonctionnalites

### Generation
- Si LLM configure → collecte donnees + envoi au LLM → resume structure
- Si pas de LLM → retourne `rawData` + `brief: ""` (fallback formate cote frontend)

### Git scan
- Variable d'env `GIT_SCAN_REPOS` : chemins de repos git locaux
- Execute `git log --since="yesterday" --oneline --author="<user>"` sur chaque repo
- Section "Code" dans le brief

### Templates customisables
- `BriefSettings.tsx` : presets + templates custom
- Prompt systeme configurable (sections, langue, style)

### Prompt par defaut
```
Tu es un assistant qui genere des briefs quotidiens pour un developpeur.
Regles :
- Ecris en francais
- 3 sections : "Hier", "Aujourd'hui", "Blocages"
- 2-4 bullet points par section
- Verbes d'action au passe compose (hier) et infinitif (aujourd'hui)
- Section vide → "RAS"
- Mentionne les durees de focus si > 30min
- Sois concis et actionnable
```

### UI
- Bouton "Brief" dans le header dashboard (a cote de "Bilan hebdo" et "Statistiques")
- Overlay avec rendu markdown
- Boutons : Regenerer, Copier, Editer
