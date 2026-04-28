import { describe, it, expect } from "bun:test";
import {
  buildEmailPrompt,
  buildRssPrompt,
  buildSnippetPrompt,
  buildTaskPrompt,
  buildFluxTriagePrompt,
} from "../../ui/components/ide/cookiaPromptBuilders";

describe("buildEmailPrompt", () => {
  it("inclut l'expéditeur", () => {
    const prompt = buildEmailPrompt({ from: "alice@ex.com", subject: "Sujet", bodyText: "Corps" });
    expect(prompt).toContain("alice@ex.com");
  });

  it("inclut le sujet", () => {
    const prompt = buildEmailPrompt({ from: "a@b.com", subject: "Mon sujet important", bodyText: "x" });
    expect(prompt).toContain("Mon sujet important");
  });

  it("inclut le corps de l'email", () => {
    const prompt = buildEmailPrompt({ from: "a@b.com", subject: "s", bodyText: "Le contenu ici" });
    expect(prompt).toContain("Le contenu ici");
  });

  it("tronque bodyText à 2000 chars", () => {
    const long = "x".repeat(3000);
    const prompt = buildEmailPrompt({ from: "a@b.com", subject: "s", bodyText: long });
    expect(prompt.length).toBeLessThan(2300);
  });

  it("gère bodyText null ou vide", () => {
    const prompt = buildEmailPrompt({ from: "a@b.com", subject: "s", bodyText: null });
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });
});

describe("buildRssPrompt", () => {
  it("inclut le feedLabel et le titre", () => {
    const prompt = buildRssPrompt({ feedLabel: "Hacker News", title: "Mon article", bodyText: null, link: null });
    expect(prompt).toContain("Hacker News");
    expect(prompt).toContain("Mon article");
  });

  it("inclut le lien si présent", () => {
    const prompt = buildRssPrompt({ feedLabel: "HN", title: "titre", bodyText: null, link: "https://example.com" });
    expect(prompt).toContain("https://example.com");
  });

  it("tronque bodyText à 2000 chars", () => {
    const long = "y".repeat(3000);
    const prompt = buildRssPrompt({ feedLabel: "F", title: "t", bodyText: long, link: null });
    expect(prompt.length).toBeLessThan(2300);
  });

  it("fonctionne sans bodyText ni lien", () => {
    const prompt = buildRssPrompt({ feedLabel: "F", title: "t", bodyText: null, link: null });
    expect(typeof prompt).toBe("string");
  });
});

describe("buildSnippetPrompt", () => {
  it("wrap le code dans un bloc markdown avec le bon langage", () => {
    const prompt = buildSnippetPrompt({ title: "Helper", language: "typescript", content: "const x = 1" });
    expect(prompt).toContain("```typescript");
    expect(prompt).toContain("const x = 1");
  });

  it("inclut le titre du snippet", () => {
    const prompt = buildSnippetPrompt({ title: "Ma fonction", language: "python", content: "def f(): pass" });
    expect(prompt).toContain("Ma fonction");
  });

  it("ferme le bloc markdown", () => {
    const prompt = buildSnippetPrompt({ title: "t", language: "js", content: "code" });
    expect(prompt).toContain("```");
    const count = (prompt.match(/```/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe("buildTaskPrompt", () => {
  it("inclut le nom de la tâche", () => {
    const prompt = buildTaskPrompt({ name: "Écrire les tests", description: null, priority: null });
    expect(prompt).toContain("Écrire les tests");
  });

  it("inclut la description si présente", () => {
    const prompt = buildTaskPrompt({ name: "t", description: "Détails importants", priority: null });
    expect(prompt).toContain("Détails importants");
  });

  it("gère description null sans crash", () => {
    const prompt = buildTaskPrompt({ name: "t", description: null, priority: null });
    expect(typeof prompt).toBe("string");
  });

  it("inclut la priorité si présente", () => {
    const prompt = buildTaskPrompt({ name: "t", description: null, priority: "high" });
    expect(prompt).toContain("high");
  });
});

describe("buildFluxTriagePrompt", () => {
  it("retourne une string non-vide", () => {
    const prompt = buildFluxTriagePrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(10);
  });

  it("mentionne l'action de triage", () => {
    const prompt = buildFluxTriagePrompt();
    expect(prompt.toLowerCase()).toContain("trier");
  });
});
