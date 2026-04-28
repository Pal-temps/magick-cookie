import { describe, it, expect } from "bun:test";
import { buildRelayUrl, formatSessionInfo } from "../../ui/components/ide/remoteControl";

describe("buildRelayUrl", () => {
  it("inclut le token dans l'URL", () => {
    const url = buildRelayUrl({ token: "abc-123", vpsHost: "https://vps.example.com", port: 9000 });
    expect(url).toContain("abc-123");
  });

  it("inclut le host VPS", () => {
    const url = buildRelayUrl({ token: "t", vpsHost: "https://myserver.io", port: 9000 });
    expect(url).toContain("myserver.io");
  });

  it("inclut le port local", () => {
    const url = buildRelayUrl({ token: "t", vpsHost: "https://x.io", port: 1234 });
    expect(url).toContain("1234");
  });

  it("génère une URL HTTPS valide", () => {
    const url = buildRelayUrl({ token: "t", vpsHost: "https://x.io", port: 9000 });
    expect(url.startsWith("https://")).toBe(true);
  });

  it("utilise le path /m (mobile relay)", () => {
    const url = buildRelayUrl({ token: "tok", vpsHost: "https://vps.io", port: 8080 });
    expect(url).toContain("/m");
  });

  it("passe le token comme paramètre de query", () => {
    const url = buildRelayUrl({ token: "mytoken", vpsHost: "https://vps.io", port: 8080 });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("t")).toBe("mytoken");
  });
});

describe("formatSessionInfo", () => {
  it("retourne le token masqué pour l'affichage", () => {
    const info = formatSessionInfo({ token: "abc-def-ghi", port: 9000, expiresAt: new Date() });
    expect(info.tokenPreview).toMatch(/^abc.*\*+/);
  });

  it("retourne le port", () => {
    const info = formatSessionInfo({ token: "tok", port: 4321, expiresAt: new Date() });
    expect(info.port).toBe(4321);
  });

  it("retourne le temps restant en secondes (approximatif)", () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    const info = formatSessionInfo({ token: "tok", port: 9000, expiresAt });
    expect(info.remainingSeconds).toBeGreaterThan(29 * 60);
    expect(info.remainingSeconds).toBeLessThanOrEqual(30 * 60);
  });

  it("retourne 0 secondes si déjà expiré", () => {
    const expiresAt = new Date(Date.now() - 1000);
    const info = formatSessionInfo({ token: "tok", port: 9000, expiresAt });
    expect(info.remainingSeconds).toBe(0);
  });
});
