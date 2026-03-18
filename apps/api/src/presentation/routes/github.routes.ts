import { Hono } from "hono";
import type { GitHubService } from "../../application/github/github.service";

export function createGitHubRoutes(githubService: GitHubService) {
  const app = new Hono();

  app.get("/config", async (c) => {
    const config = await githubService.getConfig();
    if (config) {
      // Mask token in response
      return c.json({
        data: {
          ...config,
          token: config.token.substring(0, 8) + "...",
        },
      });
    }
    return c.json({ data: null });
  });

  app.put("/config", async (c) => {
    const body = await c.req.json<{ token: string; username: string; repos: string[] }>();
    const data = await githubService.saveConfig(body);
    return c.json({
      data: {
        ...data,
        token: data.token.substring(0, 8) + "...",
      },
    });
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
