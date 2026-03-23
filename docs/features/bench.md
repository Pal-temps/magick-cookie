# Bench

> Statut : **Done** — Benchmark fonctions JS/TS, stress test HTTP, stockage dans Notes, comparaison.

Outil standalone de benchmark et stress test integre dans Magick Cookie.

## Fonctionnalites

### Benchmark fonctions JS/TS
- Coller du code JS/TS → execution avec mesures de precision
- Timing : avg, min, max, P50, P95, P99, ops/sec
- Memoire : heap avg, heap peak, RSS
- Config : iterations, warmup, timeout
- Adapter pattern : JS/TS natif via Bun, extensible a Python/Rust/Go

### Stress test HTTP
- Cibler n'importe quelle URL (locale ou distante)
- Methodes : GET, POST, PUT, DELETE
- Mesures : throughput (req/s), latence (percentiles), error rate, status codes
- Config : concurrency, total requests ou duration, timeout par requete
- Detection auto de l'API locale (localhost:47300)

### Stockage dans Notes
- Resultats sauvegardes en markdown dans `_benchmarks/bench-{slug}-{date}.md`
- Format lisible avec tableaux + JSON brut
- Git-syncable (via le vault Notes)

### Comparaison
- Detection automatique du benchmark precedent avec le meme nom
- Deltas en % par metrique (timing + memoire)
- Indicateurs colores : vert = amelioration, rouge = regression

### Historique
- Liste des benchmarks passes depuis le vault
- Groupes par nom, tries par date
- Expand pour voir les details complets

## Architecture

```
api/src/
├── domain/bench/
│   ├── bench.types.ts              # Types (config, stats, results, progress)
│   └── bench-adapter.port.ts       # Interface adapter langage
├── application/bench/
│   └── bench.service.ts            # Runner function + HTTP + markdown formatter
├── infrastructure/adapters/
│   └── bench-js.adapter.ts         # Adapter Bun/JS (Bun.nanoseconds, process.memoryUsage)
└── presentation/routes/
    └── bench.routes.ts             # SSE streaming (POST /api/bench/run/function, /run/http)

desktop/src/
├── application/stores/
│   └── benchStore.ts               # SSE consumption, notes vault save, history, comparison
└── ui/components/bench/
    ├── BenchView.tsx                # Vue standalone (3 onglets)
    ├── FunctionBenchPanel.tsx       # Config + run + resultats function
    ├── HttpBenchPanel.tsx           # Config + run + resultats HTTP
    ├── BenchHistoryPanel.tsx        # Historique depuis _benchmarks/
    └── BenchResultCard.tsx          # Carte resultats reutilisable
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST /api/bench/run/function` | SSE : progress + result | Body : FunctionBenchConfig |
| `POST /api/bench/run/http` | SSE : progress + result | Body : HttpBenchConfig |
| `POST /api/bench/format` | Formatte un resultat en markdown | Body : { result } |

Les endpoints `/run/*` retournent un stream SSE avec :
- `event: progress` — phase, current, total, elapsed
- `event: result` — BenchResult complet
- `event: error` — message d'erreur

## Acces

- Vue standalone : onglet "Bench" dans la navigation
- ViewMode : `"bench"`

## Adapter pattern

L'interface `BenchLanguageAdapter` permet d'ajouter d'autres langages :

```typescript
interface BenchLanguageAdapter {
  language: string;
  runFunctionBench(config, onProgress): Promise<FunctionBenchResult>;
  isAvailable(): Promise<boolean>;
}
```

Adapters futurs :
- Python : `Bun.spawn(["python3", tempFile])` + parse JSON
- Rust : `cargo bench` + parse criterion
- Go : `go test -bench` + parse output
