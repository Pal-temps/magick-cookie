import { describe, it, expect } from "bun:test";
import { buildContextParts } from "../../ui/components/ide/contextInjection";

describe("buildContextParts", () => {
  it("retourne [] si aucun contexte fourni et mode = general", () => {
    const parts = buildContextParts({ mode: "general", claudeMd: null, workflowPart: null });
    expect(parts).toEqual([]);
  });

  it("n'inclut pas le mode hint si mode = general, même avec du contexte", () => {
    const parts = buildContextParts({
      mode: "general",
      claudeMd: "mon CLAUDE.md",
      workflowPart: null,
    });
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain("CLAUDE.md");
    expect(parts[0]).not.toContain("[Mode:");
  });

  it("inclut le CLAUDE.md si fourni", () => {
    const parts = buildContextParts({ mode: "general", claudeMd: "contenu projet", workflowPart: null });
    expect(parts.some((p) => p.includes("contenu projet"))).toBe(true);
  });

  it("inclut le workflowPart si fourni", () => {
    const parts = buildContextParts({ mode: "general", claudeMd: null, workflowPart: "Mon workflow" });
    expect(parts.some((p) => p.includes("Mon workflow"))).toBe(true);
  });

  it("inclut le mode hint en dernière position si mode != general", () => {
    const parts = buildContextParts({
      mode: "brief",
      claudeMd: "CLAUDE.md content",
      workflowPart: "workflow content",
    });
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const last = parts[parts.length - 1];
    expect(last.startsWith("[Mode:")).toBe(true);
  });

  it("inclut le mode hint même si aucun autre contexte (mode != general)", () => {
    const parts = buildContextParts({ mode: "triage", claudeMd: null, workflowPart: null });
    expect(parts).toHaveLength(1);
    expect(parts[0].startsWith("[Mode:")).toBe(true);
  });

  it("l'ordre est : claudeMd → workflowPart → mode hint", () => {
    const parts = buildContextParts({
      mode: "ide-dev",
      claudeMd: "A",
      workflowPart: "B",
    });
    expect(parts[0]).toContain("A");
    expect(parts[1]).toContain("B");
    expect(parts[2].startsWith("[Mode:")).toBe(true);
  });
});
