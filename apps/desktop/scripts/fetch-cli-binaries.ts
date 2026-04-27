/**
 * Dev-only utility: pre-warms devops CLI binaries (gh, glab, ...) into a local
 * directory by reading the shared manifest at `apps/desktop/src-tauri/cli-manifest.json`.
 * The runtime install path lives in the Rust BinaryManager — this script exists
 * for offline test fixtures and quick local poking.
 *
 * Usage:
 *   bun run scripts/fetch-cli-binaries.ts            # current platform only
 *   bun run scripts/fetch-cli-binaries.ts --all      # all platforms
 *   bun run scripts/fetch-cli-binaries.ts --force    # re-download even if present
 */

import { mkdir, writeFile, rm, readFile, access, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const BINARIES_DIR = join(__dirname, "..", "src-tauri", "binaries");
export const MANIFEST_PATH = join(__dirname, "..", "src-tauri", "cli-manifest.json");

export const ALL_TRIPLES = [
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
] as const;
export type Triple = (typeof ALL_TRIPLES)[number];

export type ArchiveType = "zip" | "tar.gz";

export interface ResolvedAsset {
  url: string;
  archive: ArchiveType;
  innerPath: string;
  checksumsUrl: string;
  archiveBasename: string;
}

export interface CliSpec {
  name: string;
  version: string;
  resolve: (triple: Triple) => ResolvedAsset;
}

interface ManifestAssetEntry {
  asset: string;
  archive: ArchiveType;
  innerPath: string;
}

interface ManifestCliEntry {
  version: string;
  displayName: string;
  homepage: string;
  license?: string;
  release: { urlBase: string; checksumsAsset: string };
  assets: Record<Triple, ManifestAssetEntry>;
}

export interface CliManifest {
  $schema_version: number;
  clis: Record<string, ManifestCliEntry>;
}

function substVersion(template: string, version: string): string {
  return template.replaceAll("{version}", version);
}

function manifestEntryToSpec(name: string, entry: ManifestCliEntry): CliSpec {
  return {
    name,
    version: entry.version,
    resolve(triple) {
      const asset = entry.assets[triple];
      if (!asset) throw new Error(`No asset for ${name}@${entry.version} on ${triple}`);
      const urlBase = substVersion(entry.release.urlBase, entry.version);
      const archiveBasename = substVersion(asset.asset, entry.version);
      const checksumsUrl = `${urlBase}/${substVersion(entry.release.checksumsAsset, entry.version)}`;
      return {
        url: `${urlBase}/${archiveBasename}`,
        archive: asset.archive,
        innerPath: substVersion(asset.innerPath, entry.version),
        checksumsUrl,
        archiveBasename,
      };
    },
  };
}

export function loadManifest(path: string = MANIFEST_PATH): CliManifest {
  // Bun's `import` of JSON works, but we keep this synchronous-readable helper
  // so the Rust port can mirror it 1:1 (read the JSON, parse, walk).
  const raw = require("node:fs").readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as CliManifest;
  if (parsed.$schema_version !== 1) {
    throw new Error(`Unsupported cli-manifest schema_version: ${parsed.$schema_version}`);
  }
  return parsed;
}

export function manifestToSpecs(m: CliManifest): CliSpec[] {
  return Object.entries(m.clis).map(([name, entry]) => manifestEntryToSpec(name, entry));
}

export const MANIFEST: CliManifest = loadManifest();
export const CLIS: CliSpec[] = manifestToSpecs(MANIFEST);
export const GH_VERSION: string = MANIFEST.clis.gh!.version;

export function tripleFor(platform: NodeJS.Platform, arch: string): Triple {
  if (platform === "win32"  && arch === "x64")   return "x86_64-pc-windows-msvc";
  if (platform === "win32"  && arch === "arm64") return "aarch64-pc-windows-msvc";
  if (platform === "darwin" && arch === "x64")   return "x86_64-apple-darwin";
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "linux"  && arch === "x64")   return "x86_64-unknown-linux-gnu";
  if (platform === "linux"  && arch === "arm64") return "aarch64-unknown-linux-gnu";
  throw new Error(`Unsupported host platform: ${platform}/${arch}`);
}

export function currentTriple(): Triple {
  return tripleFor(process.platform, process.arch);
}

export function parseChecksum(checksumsFile: string, archiveBasename: string): string | null {
  const line = checksumsFile
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.endsWith(`  ${archiveBasename}`) || l.endsWith(` ${archiveBasename}`));
  if (!line) return null;
  return line.split(/\s+/)[0] ?? null;
}

export function targetBinaryName(cliName: string, triple: Triple): string {
  const isWindows = triple.includes("windows");
  return `${cliName}-${triple}${isWindows ? ".exe" : ""}`;
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function sha256File(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

async function fetchToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(dest, buf);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.text();
}

function runExtractor(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

async function extractArchive(archivePath: string, outDir: string, archiveType: "zip" | "tar.gz"): Promise<void> {
  const file = basename(archivePath);
  if (archiveType === "tar.gz") {
    // GNU tar and BSD tar both handle gzipped tarballs.
    await runExtractor("tar", ["-xzf", file], outDir);
    return;
  }
  // ZIP: GNU tar (Git Bash on Windows) cannot read zip; use PowerShell on Windows,
  // and `unzip` on macOS / Linux.
  if (process.platform === "win32") {
    // Use .NET's ZipFile via PowerShell — always available, no module loading.
    const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path '${file}').Path, (Get-Location).Path)`;
    await runExtractor("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], outDir);
  } else {
    await runExtractor("unzip", ["-q", "-o", file], outDir);
  }
}

export async function fetchOne(
  spec: CliSpec,
  triple: Triple,
  force: boolean,
  binariesDir: string = BINARIES_DIR,
): Promise<string> {
  const r = spec.resolve(triple);
  const isWindows = triple.includes("windows");
  const targetName = targetBinaryName(spec.name, triple);
  const targetPath = join(binariesDir, targetName);

  if (!force && (await exists(targetPath))) {
    console.log(`  ✓ ${targetName} (already present)`);
    return targetPath;
  }

  console.log(`  ↓ ${spec.name}@${spec.version} → ${triple}`);

  await mkdir(binariesDir, { recursive: true });
  const tmpDir = join(binariesDir, `.tmp-${spec.name}-${triple}`);
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  try {
    const archivePath = join(tmpDir, r.archiveBasename);
    await fetchToFile(r.url, archivePath);

    const checksums = await fetchText(r.checksumsUrl);
    const expected = parseChecksum(checksums, r.archiveBasename);
    if (!expected) throw new Error(`No checksum entry for ${r.archiveBasename}`);
    const actual = await sha256File(archivePath);
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${r.archiveBasename}\n  expected: ${expected}\n  got:      ${actual}`);
    }

    await extractArchive(archivePath, tmpDir, r.archive);

    const innerBinary = join(tmpDir, r.innerPath);
    if (!(await exists(innerBinary))) {
      throw new Error(`Extracted binary missing at ${innerBinary}`);
    }

    const buf = await readFile(innerBinary);
    await writeFile(targetPath, buf);
    if (!isWindows) {
      await chmod(targetPath, 0o755);
    }
    console.log(`  ✓ ${targetName}`);
    return targetPath;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const all = args.has("--all");
  const force = args.has("--force");
  const triples: Triple[] = all ? [...ALL_TRIPLES] : [currentTriple()];

  await mkdir(BINARIES_DIR, { recursive: true });

  console.log(`→ binaries dir: ${BINARIES_DIR}`);
  console.log(`→ triples:      ${triples.join(", ")}\n`);

  for (const cli of CLIS) {
    console.log(`[${cli.name}@${cli.version}]`);
    for (const t of triples) {
      await fetchOne(cli, t, force);
    }
    console.log();
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`\n✗ fetch-cli-binaries failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
