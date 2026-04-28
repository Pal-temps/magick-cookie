import { describe, it, expect, beforeEach } from "bun:test";
import {
  getCookiaContext,
  setCookiaContext,
  clearCookiaContext,
} from "../../application/stores/cookiaContextStore";

describe("cookiaContextStore", () => {
  beforeEach(() => clearCookiaContext());

  it("démarre à null", () => {
    expect(getCookiaContext()).toBeNull();
  });

  it("setCookiaContext stocke prompt + source", () => {
    setCookiaContext({ prompt: "Résume cet email", source: "email" });
    expect(getCookiaContext()).toEqual({ prompt: "Résume cet email", source: "email" });
  });

  it("clearCookiaContext remet à null", () => {
    setCookiaContext({ prompt: "test", source: "rss" });
    clearCookiaContext();
    expect(getCookiaContext()).toBeNull();
  });

  it("setCookiaContext écrase le contexte précédent", () => {
    setCookiaContext({ prompt: "premier", source: "email" });
    setCookiaContext({ prompt: "second", source: "rss" });
    expect(getCookiaContext()?.prompt).toBe("second");
    expect(getCookiaContext()?.source).toBe("rss");
  });

  it("source peut être n'importe quelle string", () => {
    setCookiaContext({ prompt: "test", source: "snippets" });
    expect(getCookiaContext()?.source).toBe("snippets");
  });
});
