import { Hono } from "hono";
import { z } from "zod";
import type { GitHubService } from "../../application/github/github.service";
import type { GitHubConfig } from "../../domain/github/github.entity";

const saveConfigSchema = z.object({
  token: z.string().min(10).max(255),
  username: z.string().min(1).max(80),
  repos: z.array(z.string().min(1).max(140)).max(200).default([]),
});

function toPublic(cfg: GitHubConfig) {
  const { token, ...rest } = cfg;
  return {
    ...rest,
    tokenPreview: token.length >= 8 ? token.slice(0, 4) + "..." + token.slice(-4) : "***",
  };
}

export function createGitHubRoutes(githubService: GitHubService) {
  const app = new Hono();

  app.get("/config", async (c) => {
    const config = await githubService.getConfig();
    return c.json({ data: config ? toPublic(config) : null });
  });

  app.put("/config", async (c) => {
    const parsed = saveConfigSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const data = await githubService.saveConfig(parsed.data);
    return c.json({ data: toPublic(data) });
  });

  app.delete("/config", async (c) => {
    await githubService.deleteConfig();
    return c.json({ data: { ok: true } });
  });

  app.get("/runs", async (c) => {
    const data = await githubService.getWorkflowRuns();
    return c.json({ data });
  });

  app.get("/prs", async (c) => {
    const data = await githubService.getPRs();
    return c.json({ data });
  });

  app.post("/sync", async (c) => {
    const data = await githubService.syncPRs();
    return c.json({ data });
  });

  return app;
}
