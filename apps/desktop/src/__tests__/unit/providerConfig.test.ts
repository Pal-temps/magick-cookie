import { describe, it, expect } from "bun:test";
import {
  getDefaultModels,
  needsApiKey,
  getProviderLabel,
  getProviderBadge,
  ALL_PROVIDERS,
} from "../../ui/components/ide/providerConfig";

const KNOWN_PROVIDERS = ["anthropic-api", "openai-api", "gemini-api", "ollama", "lmstudio"];

describe("getDefaultModels", () => {
  it("retourne les modèles Gemini pour 'gemini-api'", () => {
    const models = getDefaultModels("gemini-api");
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.includes("gemini"))).toBe(true);
  });

  it("retourne des modèles pour tous les providers connus", () => {
    for (const provider of KNOWN_PROVIDERS) {
      const models = getDefaultModels(provider);
      expect(models.length).toBeGreaterThan(0);
    }
  });

  it("retourne [] pour un provider inconnu", () => {
    expect(getDefaultModels("unknown-provider")).toEqual([]);
  });

  it("retourne les modèles Anthropic pour 'anthropic-api'", () => {
    const models = getDefaultModels("anthropic-api");
    expect(models.some((m) => m.includes("claude"))).toBe(true);
  });
});

describe("needsApiKey", () => {
  it("retourne true pour 'gemini-api'", () => {
    expect(needsApiKey("gemini-api")).toBe(true);
  });

  it("retourne true pour 'anthropic-api'", () => {
    expect(needsApiKey("anthropic-api")).toBe(true);
  });

  it("retourne true pour 'openai-api'", () => {
    expect(needsApiKey("openai-api")).toBe(true);
  });

  it("retourne false pour 'ollama'", () => {
    expect(needsApiKey("ollama")).toBe(false);
  });

  it("retourne false pour 'lmstudio'", () => {
    expect(needsApiKey("lmstudio")).toBe(false);
  });
});

describe("getProviderLabel", () => {
  it("retourne 'Gemini' pour 'gemini-api'", () => {
    expect(getProviderLabel("gemini-api")).toBe("Gemini");
  });

  it("retourne 'Anthropic (Claude)' pour 'anthropic-api'", () => {
    expect(typeof getProviderLabel("anthropic-api")).toBe("string");
    expect(getProviderLabel("anthropic-api").length).toBeGreaterThan(0);
  });

  it.each(KNOWN_PROVIDERS)("retourne une string non-vide pour '%s'", (id) => {
    expect(getProviderLabel(id).length).toBeGreaterThan(0);
  });
});

describe("getProviderBadge", () => {
  it("retourne 'GEM' ou similaire pour 'gemini-api'", () => {
    const badge = getProviderBadge("gemini-api");
    expect(badge.length).toBeGreaterThan(0);
    expect(badge.length).toBeLessThanOrEqual(4);
  });

  it("contient 'CC' pour 'anthropic-api'", () => {
    expect(getProviderBadge("anthropic-api")).toBe("CC");
  });

  it("contient 'GPT' pour 'openai-api'", () => {
    expect(getProviderBadge("openai-api")).toBe("GPT");
  });

  it("contient 'OL' pour 'ollama'", () => {
    expect(getProviderBadge("ollama")).toBe("OL");
  });
});

describe("ALL_PROVIDERS", () => {
  it("inclut gemini-api", () => {
    expect(ALL_PROVIDERS.some((p) => p.id === "gemini-api")).toBe(true);
  });

  it("chaque provider a id, label, badge, defaultModels, needsApiKey", () => {
    for (const p of ALL_PROVIDERS) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(typeof p.badge).toBe("string");
      expect(Array.isArray(p.defaultModels)).toBe(true);
      expect(typeof p.needsApiKey).toBe("boolean");
    }
  });
});
