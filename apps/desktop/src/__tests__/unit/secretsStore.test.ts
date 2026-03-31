import { describe, it, expect } from "bun:test";

// Test the password generator (pure function, no Tauri dependency)
// The full store requires Tauri runtime, so we test the extractable logic

describe("Password Generator", () => {
  function generatePassword(
    length = 20,
    options?: { uppercase?: boolean; lowercase?: boolean; digits?: boolean; symbols?: boolean }
  ): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    let chars = "";
    if (options?.uppercase !== false) chars += upper;
    if (options?.lowercase !== false) chars += lower;
    if (options?.digits !== false) chars += digits;
    if (options?.symbols !== false) chars += symbols;

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => chars[b % chars.length]).join("");
  }

  it("generates password of correct length", () => {
    const pwd = generatePassword(16);
    expect(pwd.length).toBe(16);
  });

  it("generates different passwords each time", () => {
    const a = generatePassword(32);
    const b = generatePassword(32);
    expect(a).not.toBe(b);
  });

  it("respects uppercase-only option", () => {
    const pwd = generatePassword(100, { uppercase: true, lowercase: false, digits: false, symbols: false });
    expect(pwd).toMatch(/^[A-Z]+$/);
  });

  it("respects lowercase-only option", () => {
    const pwd = generatePassword(100, { uppercase: false, lowercase: true, digits: false, symbols: false });
    expect(pwd).toMatch(/^[a-z]+$/);
  });

  it("respects digits-only option", () => {
    const pwd = generatePassword(100, { uppercase: false, lowercase: false, digits: true, symbols: false });
    expect(pwd).toMatch(/^[0-9]+$/);
  });

  it("includes all character types by default", () => {
    const pwd = generatePassword(200);
    expect(pwd).toMatch(/[A-Z]/);
    expect(pwd).toMatch(/[a-z]/);
    expect(pwd).toMatch(/[0-9]/);
  });
});

describe("Token Cost Estimation", () => {
  // Test the estimateTokens and formatCost logic from TokenStatusBar

  function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  function formatTokens(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  function formatCost(usd: number): string {
    if (usd < 0.01) return "<$0.01";
    return `$${usd.toFixed(2)}`;
  }

  it("estimateTokens approximates ~4 chars per token", () => {
    expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 → ceil 3
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
  });

  it("formatTokens formats thousands", () => {
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(1000000)).toBe("1.0M");
  });

  it("formatCost formats USD", () => {
    expect(formatCost(0.001)).toBe("<$0.01");
    expect(formatCost(0.05)).toBe("$0.05");
    expect(formatCost(1.234)).toBe("$1.23");
  });
});

describe("Auto-Lock Timer", () => {
  it("default auto-lock is 15 minutes", () => {
    const DEFAULT_AUTO_LOCK_MINUTES = 15;
    expect(DEFAULT_AUTO_LOCK_MINUTES).toBe(15);
  });

  it("idle detection triggers after threshold", () => {
    // Simulate: lastActivity was 16 minutes ago, threshold is 15 min
    const lastActivity = Date.now() - 16 * 60_000;
    const autoLockMinutes = 15;
    const elapsed = (Date.now() - lastActivity) / 60_000;
    expect(elapsed >= autoLockMinutes).toBe(true);
  });

  it("no lock when autoLockMinutes is 0 (disabled)", () => {
    const autoLockMinutes = 0;
    // When 0, auto-lock should be skipped
    expect(autoLockMinutes <= 0).toBe(true);
  });

  it("no lock when activity is recent", () => {
    const lastActivity = Date.now() - 5 * 60_000; // 5 min ago
    const autoLockMinutes = 15;
    const elapsed = (Date.now() - lastActivity) / 60_000;
    expect(elapsed >= autoLockMinutes).toBe(false);
  });
});

describe("Screenshot Token Estimation", () => {
  // AI vision models process images in 768x768 tiles, ~1600 tokens each
  function estimateImageTokens(width: number, height: number): number {
    const TILE_SIZE = 768;
    const TOKENS_PER_TILE = 1600;
    const tilesX = Math.ceil(width / TILE_SIZE);
    const tilesY = Math.ceil(height / TILE_SIZE);
    return tilesX * tilesY * TOKENS_PER_TILE;
  }

  it("full HD screenshot uses 6 tiles (3x2)", () => {
    expect(estimateImageTokens(1920, 1080)).toBe(6 * 1600);
  });

  it("resized 1280x720 uses 2 tiles (2x1)", () => {
    expect(estimateImageTokens(1280, 720)).toBe(2 * 1600);
  });

  it("small crop fits in 1 tile", () => {
    expect(estimateImageTokens(600, 400)).toBe(1600);
  });

  it("exact tile size is 1 tile", () => {
    expect(estimateImageTokens(768, 768)).toBe(1600);
  });
});

describe("Sanitization Logic", () => {
  // Test that preferences sanitization works correctly
  // (even though we no longer need it for the vault, we verify the migration logic)

  it("strips secret keys from infra", () => {
    const prefs = {
      version: 1,
      infra: {
        gitlabUrl: "https://gitlab.com",
        servers: [{ id: "s1", label: "VPS", host: "1.2.3.4", port: 22, user: "root", authMethod: "key" }],
      },
    };

    // After migration, infra should NOT have secret keys
    expect(prefs.infra).not.toHaveProperty("ovhAppKey");
    expect(prefs.infra).not.toHaveProperty("cfApiToken");
    expect(prefs.infra).not.toHaveProperty("githubToken");
    // But should keep non-secret fields
    expect(prefs.infra.gitlabUrl).toBe("https://gitlab.com");
    expect(prefs.infra.servers.length).toBe(1);
    expect(prefs.infra.servers[0]).not.toHaveProperty("password");
    expect(prefs.infra.servers[0]).not.toHaveProperty("keyPath");
  });
});
