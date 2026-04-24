import { describe, test, expect, beforeEach } from "bun:test";

// bun test runs in pure Node/Bun — no DOM. Install a minimal in-memory localStorage shim before
// importing the module under test so `safeGetString`/`safeSetString` talk to something real.
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};

import { safeGetJSON, safeSetJSON, safeGetString, safeSetString, safeRemove } from "../../infrastructure/storage";

describe("safeGetJSON", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("returns fallback when key is missing", () => {
    const v = safeGetJSON<number[]>("missing", []);
    expect(v).toEqual([]);
  });

  test("returns parsed value when JSON is valid", () => {
    localStorage.setItem("k", JSON.stringify([1, 2, 3]));
    expect(safeGetJSON<number[]>("k", [])).toEqual([1, 2, 3]);
  });

  test("returns fallback when JSON is malformed", () => {
    localStorage.setItem("k", "{not json");
    expect(safeGetJSON<number[]>("k", [42])).toEqual([42]);
  });

  test("returns fallback when validate guard rejects the shape", () => {
    localStorage.setItem("k", JSON.stringify({ not: "an array" }));
    const v = safeGetJSON<number[]>(
      "k",
      [],
      (x): x is number[] => Array.isArray(x),
    );
    expect(v).toEqual([]);
  });

  test("returns the parsed value when validate guard accepts it", () => {
    localStorage.setItem("k", JSON.stringify([9]));
    const v = safeGetJSON<number[]>(
      "k",
      [],
      (x): x is number[] => Array.isArray(x) && x.every((n) => typeof n === "number"),
    );
    expect(v).toEqual([9]);
  });
});

describe("safeSetJSON / safeGetString / safeSetString / safeRemove", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("safeSetJSON round-trips", () => {
    expect(safeSetJSON("k", { a: 1 })).toBe(true);
    expect(safeGetJSON<{ a: number }>("k", { a: 0 })).toEqual({ a: 1 });
  });

  test("safeGetString returns null for missing keys", () => {
    expect(safeGetString("missing")).toBeNull();
  });

  test("safeSetString + safeGetString round-trip", () => {
    expect(safeSetString("k", "hello")).toBe(true);
    expect(safeGetString("k")).toBe("hello");
  });

  test("safeRemove deletes the key", () => {
    safeSetString("k", "v");
    safeRemove("k");
    expect(safeGetString("k")).toBeNull();
  });
});
