import { describe, it, expect } from "bun:test";
import {
  ALL_MODES,
  getModeHint,
  getModeLabel,
  buildModeContextPart,
  type SessionModeId,
} from "../../ui/components/ide/sessionModes";

const NON_GENERAL_IDS = ["brief", "triage", "ide-dev", "meeting-prep"] as SessionModeId[];

describe("sessionModes", () => {
  describe("ALL_MODES", () => {
    it("contient exactement 5 modes", () => {
      expect(ALL_MODES).toHaveLength(5);
    });

    it("contient les ids attendus", () => {
      const ids = ALL_MODES.map((m) => m.id);
      expect(ids).toContain("general");
      expect(ids).toContain("brief");
      expect(ids).toContain("triage");
      expect(ids).toContain("ide-dev");
      expect(ids).toContain("meeting-prep");
    });

    it("chaque mode a un id, label, description, promptHint non-vides", () => {
      for (const mode of ALL_MODES) {
        expect(typeof mode.id).toBe("string");
        expect(mode.id.length).toBeGreaterThan(0);
        expect(typeof mode.label).toBe("string");
        expect(mode.label.length).toBeGreaterThan(0);
        expect(typeof mode.description).toBe("string");
        expect(mode.description.length).toBeGreaterThan(0);
        expect(typeof mode.promptHint).toBe("string");
        expect(mode.promptHint.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getModeHint", () => {
    it("retourne null pour 'general'", () => {
      expect(getModeHint("general")).toBeNull();
    });

    it.each(NON_GENERAL_IDS)("retourne une string non-vide pour '%s'", (id) => {
      const hint = getModeHint(id);
      expect(typeof hint).toBe("string");
      expect((hint as string).length).toBeGreaterThan(0);
    });
  });

  describe("getModeLabel", () => {
    it("retourne le label pour 'general'", () => {
      expect(typeof getModeLabel("general")).toBe("string");
      expect(getModeLabel("general").length).toBeGreaterThan(0);
    });

    it.each(NON_GENERAL_IDS)("retourne le label pour '%s'", (id) => {
      expect(typeof getModeLabel(id)).toBe("string");
      expect(getModeLabel(id).length).toBeGreaterThan(0);
    });
  });
});

describe("buildModeContextPart", () => {
  it("retourne null si mode = 'general'", () => {
    expect(buildModeContextPart("general")).toBeNull();
  });

  it.each(NON_GENERAL_IDS)("retourne une string commençant par '[Mode:' pour '%s'", (id) => {
    const part = buildModeContextPart(id);
    expect(typeof part).toBe("string");
    expect((part as string).startsWith("[Mode:")).toBe(true);
  });

  it.each(NON_GENERAL_IDS)("inclut le promptHint dans la string pour '%s'", (id) => {
    const hint = getModeHint(id) as string;
    const part = buildModeContextPart(id) as string;
    expect(part).toContain(hint);
  });
});
