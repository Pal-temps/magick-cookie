import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { DnsService } from "../../infrastructure/dns/dns.service";
import type { SshService } from "../../infrastructure/ssh/ssh.service";
import type { DeployService } from "../../application/deploy/deploy.service";
import type { SkillService } from "../../application/skills/skill.service";
import type { VaultService } from "../../infrastructure/vault/vault.service";
import type { SnapshotService } from "../../application/snapshot/snapshot.service";
import { updateInfraConfig, infraConfig } from "../../config";

export function createInfraRoutes(
  dns: DnsService,
  ssh: SshService,
  deploy: DeployService,
  skills: SkillService,
  vault: VaultService,
  snapshot: SnapshotService,
) {
  const app = new Hono();

  // ─── Config sync (from desktop app settings) ───

  app.post("/config", async (c) => {
    const body = await c.req.json();
    updateInfraConfig(body);
    // Set vault path if provided
    if (body.vaultPath) {
      vault.setVaultPath(body.vaultPath);
    }
    // Also sync servers to SshService
    if (body.servers && Array.isArray(body.servers)) {
      for (const s of body.servers) {
        if (!ssh.getServer(s.id)) {
          ssh.addServer({ label: s.label, host: s.host, port: s.port, user: s.user, authMethod: s.authMethod, keyPath: s.keyPath });
        }
      }
    }
    return c.json({ synced: true });
  });

  app.get("/config/status", (c) => {
    return c.json({
      ovh: !!(infraConfig.ovhAppKey && infraConfig.ovhAppSecret),
      cloudflare: !!infraConfig.cfApiToken,
      github: !!infraConfig.githubToken,
      gitlab: !!infraConfig.gitlabToken,
      servers: ssh.listServers().length,
    });
  });

  // ─── DNS ───

  app.get("/dns/zones", async (c) => {
    const zones = await dns.getZones();
    return c.json(zones);
  });

  app.get("/dns/records/:zone", async (c) => {
    const zone = c.req.param("zone");
    const type = c.req.query("type");
    const records = await dns.listRecords(zone, type);
    return c.json(records);
  });

  app.post("/dns/records/:zone", async (c) => {
    const zone = c.req.param("zone");
    const body = await c.req.json();
    const record = await dns.createRecord(zone, body);
    return c.json(record, 201);
  });

  app.delete("/dns/records/:zone/:id", async (c) => {
    const zone = c.req.param("zone");
    const id = c.req.param("id");
    await dns.deleteRecord(zone, id);
    return c.json({ deleted: true });
  });

  // ─── Servers ───

  app.get("/servers", (c) => {
    return c.json(ssh.listServers());
  });

  app.post("/servers", async (c) => {
    const body = await c.req.json();
    const server = ssh.addServer(body);
    return c.json(server, 201);
  });

  app.delete("/servers/:id", (c) => {
    const deleted = ssh.removeServer(c.req.param("id"));
    return c.json({ deleted });
  });

  // ─── SSH ───

  app.post("/ssh/exec", async (c) => {
    const { server_id, command } = await c.req.json();
    const result = await ssh.exec(server_id, command);
    return c.json(result);
  });

  // ─── Deploy (SSE streaming) ───

  app.post("/deploy", async (c) => {
    const config = await c.req.json();

    return streamSSE(c, async (stream) => {
      for await (const event of deploy.deploy(config)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    });
  });

  // ─── Skills ───

  app.get("/skills", (c) => {
    return c.json({
      skills: skills.listSkills(),
      hooks: skills.listHooks(),
    });
  });

  app.get("/skills/:name", (c) => {
    const skill = skills.getSkill(c.req.param("name"));
    if (!skill) return c.json({ error: "Skill not found" }, 404);
    return c.json(skill);
  });

  // ─── Snapshot ───

  app.post("/snapshot", async (c) => {
    const result = await snapshot.exportSnapshot();
    return c.json(result);
  });

  return app;
}
