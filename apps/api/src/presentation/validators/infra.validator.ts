import { z } from "zod";

const serverDescriptor = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(255),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1).max(64),
  authMethod: z.enum(["key", "password"]),
  keyPath: z.string().max(512).optional(),
});

// .strict() rejects any field not listed here — prevents extra attacker-supplied keys from
// reaching `Object.assign(infraConfig, body)` in updateInfraConfig().
export const infraConfigSchema = z.object({
  ovhAppKey: z.string().max(255).optional(),
  ovhAppSecret: z.string().max(255).optional(),
  ovhConsumerKey: z.string().max(255).optional(),
  cfApiToken: z.string().max(255).optional(),
  githubToken: z.string().max(255).optional(),
  gitlabToken: z.string().max(255).optional(),
  gitlabUrl: z.string().url().max(255).optional(),
  vaultPath: z.string().min(1).max(4096).optional(),
  servers: z.array(serverDescriptor).max(100).optional(),
}).strict();

export const sshExecSchema = z.object({
  server_id: z.string().min(1).max(64),
  command: z.string().min(1).max(4096),
});

export const dnsRecordSchema = z.object({
  type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "NS"]),
  name: z.string().min(1).max(253),
  content: z.string().min(1).max(1024),
  ttl: z.number().int().min(60).max(604800).optional(),
  priority: z.number().int().min(0).max(65535).optional(),
});

export const addServerSchema = z.object({
  label: z.string().min(1).max(255),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1).max(64),
  authMethod: z.enum(["key", "password"]),
  keyPath: z.string().max(512).optional(),
  password: z.string().max(255).optional(),
});

// repoUrl must point to an HTTP(S) or SSH clone endpoint. We explicitly reject `file://`,
// `ftp://`, etc. which `git clone` would otherwise happily follow (local file exfiltration,
// arbitrary filesystem access on the build host).
const repoUrlSchema = z
  .string()
  .max(1024)
  .regex(
    /^(https:\/\/|git:\/\/|git@|ssh:\/\/)[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/,
    "repoUrl must start with https://, git://, ssh://, or git@",
  );

// appPath, when overridden by the caller, must still be anchored under /opt/apps — no `..`,
// no absolute jumps out of the apps root. Most callers should leave this unset so the service
// derives it from appName.
const appPathSchema = z
  .string()
  .max(512)
  .regex(/^\/opt\/apps\/[a-zA-Z0-9_-]{1,63}$/, "appPath must be /opt/apps/<alphanum-name>");

export const deployConfigSchema = z.object({
  appName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/),
  subdomain: z.string().regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/),
  zone: z.string().regex(/^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,252}[a-zA-Z0-9])?$/),
  serverIp: z.string().min(1).max(64),
  serverId: z.string().min(1).max(64),
  repoUrl: repoUrlSchema.optional(),
  gitProvider: z.enum(["vps-bare", "github", "gitlab"]).optional(),
  buildCommand: z.string().min(1).max(2048),
  startCommand: z.string().min(1).max(2048),
  appPort: z.number().int().min(1).max(65535),
  appPath: appPathSchema.optional(),
}).strict();
