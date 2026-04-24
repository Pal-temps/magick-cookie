import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { DnsService } from "../../infrastructure/dns/dns.service";
import type { SshService } from "../../infrastructure/ssh/ssh.service";
import type { DeployService } from "../../application/deploy/deploy.service";
import type { SkillService } from "../../application/skills/skill.service";
import type { VaultService } from "../../infrastructure/vault/vault.service";
import type { SnapshotService } from "../../application/snapshot/snapshot.service";
import { updateInfraConfig, infraConfig } from "../../config";
import {
  infraConfigSchema,
  sshExecSchema,
  dnsRecordSchema,
  addServerSchema,
  deployConfigSchema,
} from "../validators/infra.validator";

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
    const parsed = infraConfigSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;
    updateInfraConfig(body);
    if (body.vaultPath) vault.setVaultPath(body.vaultPath);
    if (body.servers) {
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
    const parsed = dnsRecordSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const record = await dns.createRecord(zone, parsed.data);
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
    const parsed = addServerSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const server = ssh.addServer(parsed.data);
    return c.json(server, 201);
  });

  app.delete("/servers/:id", (c) => {
    const deleted = ssh.removeServer(c.req.param("id"));
    return c.json({ deleted });
  });

  // ─── SSH ───

  app.post("/ssh/exec", async (c) => {
    const parsed = sshExecSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const result = await ssh.exec(parsed.data.server_id, parsed.data.command);
    return c.json(result);
  });

  // ─── Deploy (SSE streaming) ───

  app.post("/deploy", async (c) => {
    const parsed = deployConfigSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    return streamSSE(c, async (stream) => {
      for await (const event of deploy.deploy(parsed.data)) {
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
