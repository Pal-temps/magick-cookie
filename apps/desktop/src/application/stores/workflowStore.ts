import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ─── Types ───

export interface WorkflowTemplate {
  /** File name without extension (e.g. "ddd-full-project") */
  id: string;
  name: string;
  description: string;
  model: string;
  permissionMode: string;
  preCommit: string[];
  postCommit: string[];
  /** The full markdown instructions (body after frontmatter) */
  instructions: string;
  /** Vault path for the file */
  path: string;
}

// ─── State ───

const [workflows, setWorkflows] = createSignal<WorkflowTemplate[]>([]);
const [activeWorkflowId, setActiveWorkflowId] = createSignal<string | null>(
  localStorage.getItem("ide-active-workflow") ?? null
);
// Per-session overrides: sessionId → workflowId
const [sessionWorkflows, setSessionWorkflows] = createSignal<Map<string, string>>(new Map());
const [editingWorkflowId, setEditingWorkflowId] = createSignal<string | null>(null);

// ─── Frontmatter parser ───

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, unknown> = {};
  let currentKey = "";
  let inArray = false;
  const arrayItems: string[] = [];

  for (const line of match[1].split("\n")) {
    const kvMatch = line.match(/^(\w[\w\s]*?):\s*(.*)$/);
    if (kvMatch && !line.startsWith("  -")) {
      if (inArray && currentKey) {
        meta[currentKey] = [...arrayItems];
        arrayItems.length = 0;
        inArray = false;
      }
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === "") {
        inArray = true;
      } else {
        meta[currentKey] = val;
      }
    } else if (line.match(/^\s+-\s+(.*)$/) && inArray) {
      arrayItems.push(line.replace(/^\s+-\s+/, ""));
    }
  }
  if (inArray && currentKey) {
    meta[currentKey] = [...arrayItems];
  }

  return { meta, body: match[2].trim() };
}

function toFrontmatter(template: WorkflowTemplate): string {
  const lines: string[] = ["---"];
  lines.push(`name: ${template.name}`);
  lines.push(`description: ${template.description}`);
  if (template.model) lines.push(`model: ${template.model}`);
  if (template.permissionMode) lines.push(`permissionMode: ${template.permissionMode}`);
  if (template.preCommit.length > 0) {
    lines.push("preCommit:");
    for (const cmd of template.preCommit) lines.push(`  - ${cmd}`);
  }
  if (template.postCommit.length > 0) {
    lines.push("postCommit:");
    for (const cmd of template.postCommit) lines.push(`  - ${cmd}`);
  }
  lines.push("---");
  lines.push("");
  lines.push(template.instructions);
  return lines.join("\n");
}

function parseTemplate(id: string, path: string, raw: string): WorkflowTemplate {
  const { meta, body } = parseFrontmatter(raw);
  return {
    id,
    name: (meta.name as string) || id,
    description: (meta.description as string) || "",
    model: (meta.model as string) || "",
    permissionMode: (meta.permissionMode as string) || "default",
    preCommit: Array.isArray(meta.preCommit) ? meta.preCommit as string[] : [],
    postCommit: Array.isArray(meta.postCommit) ? meta.postCommit as string[] : [],
    instructions: body,
    path,
  };
}

// ─── Presets ───

const PRESETS: Record<string, () => WorkflowTemplate> = {
  "ddd-strict": () => ({
    id: "ddd-strict",
    name: "DDD Strict",
    description: "Architecture DDD complete, tests unitaires, pre-commit strict",
    model: "",
    permissionMode: "default",
    preCommit: ["bun test", "tsc --noEmit"],
    postCommit: [],
    instructions: `## Architecture DDD

- **Domain** : Entities, Value Objects, Repository Interfaces, Domain Events
- **Application** : Use Cases (un par action), DTOs, Application Services
- **Infrastructure** : Repository Implementations, Database, External APIs
- **Presentation** : Controllers, Validators, Mappers

## Regles

- Toute logique metier dans le Domain, jamais dans les controllers
- Les Use Cases orchestrent, ne contiennent pas de logique metier
- Repository pattern obligatoire pour l'acces aux donnees
- Un fichier = une responsabilite

## Tests

- Un test unitaire par Use Case (minimum)
- Mocks pour les repositories dans les tests unitaires
- Tests d'integration pour les Repository Implementations
- Pas de test pour les DTOs/Mappers simples

## Pre-commit

Avant chaque commit, verifier :
1. Tous les tests passent
2. TypeScript compile sans erreur
3. Pas de \`any\` dans le code
4. Pas de \`console.log\` oublie`,
    path: "_workflows/ddd-strict.md",
  }),
  "tdd-red-green": () => ({
    id: "tdd-red-green",
    name: "TDD Red-Green-Refactor",
    description: "Test-Driven Development strict, ecrire les tests en premier",
    model: "",
    permissionMode: "default",
    preCommit: ["bun test"],
    postCommit: [],
    instructions: `## Methode TDD

Suivre strictement le cycle Red-Green-Refactor :

### 1. RED — Ecrire le test en premier
- Ecrire un test qui echoue
- Le test decrit le comportement attendu
- NE PAS ecrire de code de production

### 2. GREEN — Faire passer le test
- Ecrire le minimum de code pour que le test passe
- Pas d'optimisation, pas de refactoring
- Le code peut etre "sale" a cette etape

### 3. REFACTOR — Nettoyer
- Refactoriser le code de production ET les tests
- Les tests doivent toujours passer
- Eliminer la duplication

## Regles strictes

- JAMAIS de code de production sans test qui le valide
- Un commit par cycle Red-Green-Refactor
- Nommer les tests: \`should [comportement] when [condition]\`
- Coverage minimum: 80%`,
    path: "_workflows/tdd-red-green.md",
  }),
  "quick-fix": () => ({
    id: "quick-fix",
    name: "Quick Fix",
    description: "Corrections rapides, pas de tests requis",
    model: "",
    permissionMode: "default",
    preCommit: [],
    postCommit: [],
    instructions: `## Mode Quick Fix

- Corriger le bug ou le probleme specifique
- Ne pas refactoriser le code autour
- Ne pas ajouter de tests sauf si le bug est une regression
- Commit messages: \`fix: description courte du bug\`
- Garder le diff minimal`,
    path: "_workflows/quick-fix.md",
  }),
};

// ─── Store ───

export function useWorkflowStore() {
  async function fetchWorkflows() {
    try {
      const entries = await invoke<{ name: string; path: string }[]>(
        "vault_list_section", { section: "_workflows", ext: ".md" }
      );
      const templates: WorkflowTemplate[] = [];
      for (const entry of entries) {
        try {
          const fullPath = `_workflows/${entry.path}`;
          const content = await invoke<string>("vault_read_json", { relPath: fullPath });
          const id = entry.name.replace(/\.md$/, "");
          templates.push(parseTemplate(id, fullPath, content));
        } catch (e) {
          console.error("Failed to read workflow:", entry.path, e);
        }
      }
      setWorkflows(templates);
    } catch {
      setWorkflows([]);
    }
  }

  async function createFromPreset(presetId: string): Promise<WorkflowTemplate | null> {
    const factory = PRESETS[presetId];
    if (!factory) return null;
    const template = factory();
    const content = toFrontmatter(template);
    await invoke("vault_write_json", { relPath: template.path, content });
    await fetchWorkflows();
    return template;
  }

  async function createWorkflow(name: string): Promise<WorkflowTemplate> {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const path = `_workflows/${id}.md`;
    const template: WorkflowTemplate = {
      id, name, description: "", model: "", permissionMode: "default",
      preCommit: [], postCommit: [], instructions: `## ${name}\n\nInstructions ici...\n`, path,
    };
    const content = toFrontmatter(template);
    await invoke("vault_write_json", { relPath: path, content });
    await fetchWorkflows();
    return template;
  }

  async function deleteWorkflow(id: string) {
    const wf = workflows().find((w) => w.id === id);
    if (!wf) return;
    try {
      await invoke("vault_delete_file", { relPath: wf.path });
    } catch (e) {
      console.error("Failed to delete workflow:", e);
    }
    await fetchWorkflows();
    if (activeWorkflowId() === id) {
      setActiveWorkflowId(null);
      localStorage.removeItem("ide-active-workflow");
    }
  }

  function selectWorkflow(id: string | null) {
    setActiveWorkflowId(id);
    if (id) localStorage.setItem("ide-active-workflow", id);
    else localStorage.removeItem("ide-active-workflow");
  }

  function assignWorkflowToSession(sessionId: string, workflowId: string | null) {
    setSessionWorkflows((prev) => {
      const next = new Map(prev);
      if (workflowId) next.set(sessionId, workflowId);
      else next.delete(sessionId);
      return next;
    });
  }

  /** Get the active workflow for a given session (session override > global default) */
  function getWorkflowForSession(sessionId: string): WorkflowTemplate | null {
    const overrideId = sessionWorkflows().get(sessionId);
    const id = overrideId ?? activeWorkflowId();
    if (!id) return null;
    return workflows().find((w) => w.id === id) ?? null;
  }

  function activeWorkflow(): WorkflowTemplate | null {
    const id = activeWorkflowId();
    if (!id) return null;
    return workflows().find((w) => w.id === id) ?? null;
  }

  return {
    workflows,
    activeWorkflowId,
    activeWorkflow,
    editingWorkflowId,
    setEditingWorkflowId,
    fetchWorkflows,
    createFromPreset,
    createWorkflow,
    deleteWorkflow,
    selectWorkflow,
    assignWorkflowToSession,
    getWorkflowForSession,
    presetIds: Object.keys(PRESETS),
    presets: PRESETS,
  };
}
