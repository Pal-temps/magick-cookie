import type { AgentTool } from "../tool-registry";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const CODE_PROJECTS_ENV = "CODE_PROJECTS";

function getAllowedRoots(): string[] {
  const raw = process.env[CODE_PROJECTS_ENV];
  if (!raw) return [];
  return raw.split(",").map((p) => p.trim()).filter(Boolean);
}

function isPathAllowed(absPath: string): boolean {
  const roots = getAllowedRoots();
  if (roots.length === 0) return true; // no restriction if not configured
  return roots.some((root) => absPath.startsWith(root));
}

async function walkDir(dir: string, base: string, results: string[], maxDepth: number, depth = 0): Promise<void> {
  if (depth > maxDepth) return;
  const SKIP = new Set([".git", "node_modules", "target", "__pycache__", ".next", "dist", ".nuxt"]);

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const rel = relative(base, full);
    if (entry.isDirectory()) {
      results.push(rel + "/");
      await walkDir(full, base, results, maxDepth, depth + 1);
    } else {
      results.push(rel);
    }
  }
}

export function createCodeTools(): AgentTool[] {
  return [
    {
      name: "list_project_files",
      description: "Liste les fichiers d'un projet (arborescence). Utile pour comprendre la structure du code.",
      parameters: {
        projectPath: { type: "string", description: "Chemin absolu du dossier projet", required: true },
        maxDepth: { type: "number", description: "Profondeur max (defaut 3)", required: false },
      },
      execute: async (params) => {
        const projectPath = params.projectPath as string;
        if (!isPathAllowed(projectPath)) return { error: "Path not allowed" };
        const results: string[] = [];
        const maxDepth = (params.maxDepth as number) ?? 3;
        await walkDir(projectPath, projectPath, results, maxDepth);
        return { files: results, count: results.length };
      },
    },
    {
      name: "read_project_file",
      description: "Lit le contenu d'un fichier dans un projet. Retourne le texte du fichier.",
      parameters: {
        projectPath: { type: "string", description: "Chemin absolu du dossier projet", required: true },
        filePath: { type: "string", description: "Chemin relatif du fichier dans le projet", required: true },
      },
      execute: async (params) => {
        const projectPath = params.projectPath as string;
        const filePath = params.filePath as string;
        const absPath = join(projectPath, filePath);
        if (!isPathAllowed(absPath)) return { error: "Path not allowed" };
        try {
          const content = await readFile(absPath, "utf-8");
          // Truncate very large files
          if (content.length > 50000) {
            return { content: content.slice(0, 50000), truncated: true, totalLength: content.length };
          }
          return { content };
        } catch (e) {
          return { error: `Cannot read file: ${e}` };
        }
      },
    },
    {
      name: "write_project_file",
      description: "Ecrit ou modifie un fichier dans un projet.",
      parameters: {
        projectPath: { type: "string", description: "Chemin absolu du dossier projet", required: true },
        filePath: { type: "string", description: "Chemin relatif du fichier", required: true },
        content: { type: "string", description: "Contenu a ecrire", required: true },
      },
      execute: async (params) => {
        const projectPath = params.projectPath as string;
        const filePath = params.filePath as string;
        const content = params.content as string;
        const absPath = join(projectPath, filePath);
        if (!isPathAllowed(absPath)) return { error: "Path not allowed" };
        try {
          await Bun.write(absPath, content);
          return { success: true, path: filePath };
        } catch (e) {
          return { error: `Cannot write file: ${e}` };
        }
      },
    },
    {
      name: "search_in_project",
      description: "Recherche un pattern (texte ou regex) dans les fichiers d'un projet. Retourne les fichiers et lignes correspondantes.",
      parameters: {
        projectPath: { type: "string", description: "Chemin absolu du dossier projet", required: true },
        pattern: { type: "string", description: "Texte ou regex a rechercher", required: true },
        glob: { type: "string", description: "Filtre glob (ex: '*.ts', '*.py')", required: false },
      },
      execute: async (params) => {
        const projectPath = params.projectPath as string;
        if (!isPathAllowed(projectPath)) return { error: "Path not allowed" };
        const pattern = params.pattern as string;
        const glob = params.glob as string | undefined;

        // Use grep via child_process for performance
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);

        try {
          let cmd = `grep -rn --include="${glob ?? "*"}" "${pattern.replace(/"/g, '\\"')}" "${projectPath}"`;
          const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024, timeout: 10000 });
          const lines = stdout.trim().split("\n").slice(0, 50); // cap at 50 results
          const results = lines.map((line) => {
            const [file, ...rest] = line.split(":");
            const relFile = relative(projectPath, file);
            return { file: relFile, match: rest.join(":").trim() };
          });
          return { results, count: results.length };
        } catch {
          return { results: [], count: 0 };
        }
      },
    },
  ];
}
