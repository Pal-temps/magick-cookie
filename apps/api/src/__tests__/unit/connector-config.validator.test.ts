import { describe, it, expect } from "bun:test";
import {
  connectorTypeSchema,
  upsertConnectorConfigSchema,
} from "../../presentation/validators/connector-config.validator";

describe("connectorTypeSchema", () => {
  it("accepts 'clickup'", () => {
    const result = connectorTypeSchema.safeParse("clickup");
    expect(result.success).toBe(true);
  });

  it("accepts 'github'", () => {
    const result = connectorTypeSchema.safeParse("github");
    expect(result.success).toBe(true);
  });

  it("accepts 'gitlab'", () => {
    const result = connectorTypeSchema.safeParse("gitlab");
    expect(result.success).toBe(true);
  });

  it("rejects 'invalid'", () => {
    const result = connectorTypeSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = connectorTypeSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects 'jira'", () => {
    const result = connectorTypeSchema.safeParse("jira");
    expect(result.success).toBe(false);
  });
});

describe("upsertConnectorConfigSchema", () => {
  it("accepts valid input with token + settings", () => {
    const result = upsertConnectorConfigSchema.safeParse({
      token: "ghp_abc123",
      settings: { username: "octocat", repos: ["repo1"] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe("ghp_abc123");
      expect(result.data.settings).toEqual({ username: "octocat", repos: ["repo1"] });
    }
  });

  it("accepts token only (settings defaults to {})", () => {
    const result = upsertConnectorConfigSchema.safeParse({
      token: "glpat_xyz",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe("glpat_xyz");
      expect(result.data.settings).toEqual({});
    }
  });

  it("rejects empty token", () => {
    const result = upsertConnectorConfigSchema.safeParse({
      token: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = upsertConnectorConfigSchema.safeParse({
      settings: { foo: "bar" },
    });
    expect(result.success).toBe(false);
  });
});
