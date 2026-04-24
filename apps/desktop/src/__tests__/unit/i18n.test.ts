import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Detect duplicate keys in i18n files ───
// JS silently allows duplicate keys in object literals (last wins).
// We parse the raw text to catch them before they cause silent overwrites.

const I18N_DIR = resolve(import.meta.dir, "../../i18n");
const FILES = ["fr.ts", "en.ts"];

interface DuplicateEntry {
  key: string;
  scope: string;
  lines: number[];
}

function findDuplicateKeys(source: string): DuplicateEntry[] {
  const lines = source.split("\n");
  const duplicates: DuplicateEntry[] = [];

  // Stack tracks the current scope path (e.g. ["common"], ["settings"])
  const scopeStack: string[] = [];
  // Map: scope path string -> Map of key -> list of line numbers
  const keysPerScope = new Map<string, Map<string, number[]>>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track closing braces to pop scope
    const trimmed = line.trim();
    if (trimmed === "}," || trimmed === "}") {
      scopeStack.pop();
      continue;
    }

    // Match a key that opens a nested object: `  someKey: {`
    const objectMatch = trimmed.match(/^(\w+)\s*:\s*\{/);
    if (objectMatch) {
      const key = objectMatch[1];
      const parentScope = scopeStack.join(".");

      // Record the key in its parent scope
      if (parentScope) {
        if (!keysPerScope.has(parentScope)) {
          keysPerScope.set(parentScope, new Map());
        }
        const scopeKeys = keysPerScope.get(parentScope)!;
        if (!scopeKeys.has(key)) {
          scopeKeys.set(key, []);
        }
        scopeKeys.get(key)!.push(lineNum);
      }

      scopeStack.push(key);
      continue;
    }

    // Match a leaf key: `  someKey: "value",` or `someKey: "value",`
    const leafMatch = trimmed.match(/^(\w+)\s*:/);
    if (leafMatch) {
      const key = leafMatch[1];
      // Skip TypeScript keywords / non-translation lines
      if (key === "import" || key === "export" || key === "type") continue;

      const scope = scopeStack.join(".");
      if (!scope) continue; // skip root-level non-object lines

      if (!keysPerScope.has(scope)) {
        keysPerScope.set(scope, new Map());
      }
      const scopeKeys = keysPerScope.get(scope)!;
      if (!scopeKeys.has(key)) {
        scopeKeys.set(key, []);
      }
      scopeKeys.get(key)!.push(lineNum);
    }
  }

  // Collect duplicates
  for (const [scope, keys] of keysPerScope) {
    for (const [key, lineNums] of keys) {
      if (lineNums.length > 1) {
        duplicates.push({ key, scope, lines: lineNums });
      }
    }
  }

  return duplicates;
}

describe("i18n — no duplicate keys", () => {
  for (const file of FILES) {
    test(`${file} has no duplicate keys`, () => {
      const filePath = resolve(I18N_DIR, file);
      const source = readFileSync(filePath, "utf-8");
      const duplicates = findDuplicateKeys(source);

      if (duplicates.length > 0) {
        const details = duplicates
          .map(
            (d) =>
              `  "${d.key}" in [${d.scope}] appears ${d.lines.length} times (lines ${d.lines.join(", ")})`,
          )
          .join("\n");
        expect(duplicates).toEqual(
          [] as DuplicateEntry[],
          `Duplicate keys found in ${file}:\n${details}`,
        );
      }

      expect(duplicates).toEqual([]);
    });
  }
});
