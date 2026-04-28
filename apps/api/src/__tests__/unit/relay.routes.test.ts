import { describe, it, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { createRelayRoutes } from "../../presentation/routes/relay.routes";

describe("relay routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/api/relay", createRelayRoutes());
  });

  describe("GET /relay/:token", () => {
    it("retourne 404 pour un token inconnu", async () => {
      const res = await app.request("/api/relay/unknown-token-123");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /relay/register", () => {
    it("enregistre un token et retourne 201", async () => {
      const res = await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "test-token-abc", callbackUrl: "ws://127.0.0.1:9000" }),
      });
      expect(res.status).toBe(201);
    });

    it("retourne l'id du token enregistré", async () => {
      const res = await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "my-token", callbackUrl: "ws://127.0.0.1:9001" }),
      });
      const body = await res.json() as { token: string };
      expect(body.token).toBe("my-token");
    });

    it("retourne 400 si le token est manquant", async () => {
      const res = await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl: "ws://127.0.0.1:9000" }),
      });
      expect(res.status).toBe(400);
    });

    it("retourne 400 si le callbackUrl est manquant", async () => {
      const res = await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "some-token" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /relay/:token après enregistrement", () => {
    it("retourne 200 pour un token enregistré", async () => {
      // Register first
      await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "registered-token", callbackUrl: "ws://127.0.0.1:9002" }),
      });

      const res = await app.request("/api/relay/registered-token");
      expect(res.status).toBe(200);
    });

    it("retourne les infos du token", async () => {
      await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "info-token", callbackUrl: "ws://127.0.0.1:9003" }),
      });

      const res = await app.request("/api/relay/info-token");
      const body = await res.json() as { token: string; callbackUrl: string };
      expect(body.token).toBe("info-token");
      expect(body.callbackUrl).toBe("ws://127.0.0.1:9003");
    });
  });

  describe("DELETE /relay/:token", () => {
    it("supprime un token enregistré", async () => {
      await app.request("/api/relay/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "del-token", callbackUrl: "ws://127.0.0.1:9004" }),
      });

      const del = await app.request("/api/relay/del-token", { method: "DELETE" });
      expect(del.status).toBe(200);

      const check = await app.request("/api/relay/del-token");
      expect(check.status).toBe(404);
    });

    it("retourne 404 si le token n'existe pas", async () => {
      const res = await app.request("/api/relay/nonexistent", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });
});
