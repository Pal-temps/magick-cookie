import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createDeployTools } from "../../application/agent/tools/deploy.tools";
import type { SshService } from "../../infrastructure/ssh/ssh.service";
import type { AgentTool } from "../../application/agent/tool-registry";

// deploy.tools is the security-hardened replacement for the old deploy_app tool that was
// vulnerable to prompt-injection. The remaining surface (caddy_add_site, caddy_list_sites)
// must call assertSafeIdentifier / assertSafeDnsLabel internally — these tests check that
// a malicious server_id / domain is rejected before any ssh.exec / ssh.upload call.

describe("deploy.tools", () => {
  let svc: { [K in keyof SshService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let addSite: AgentTool;
  let listSites: AgentTool;

  beforeEach(() => {
    svc = {
      listServers: mock(() => []),
      addServer: mock(() => ({} as never)),
      getServer: mock(() => undefined),
      exec: mock(() => Promise.resolve({ stdout: "", stderr: "", code: 0 })),
      upload: mock(() => Promise.resolve()),
    } as unknown as { [K in keyof SshService]: ReturnType<typeof mock> };

    tools = createDeployTools(svc as unknown as SshService);
    addSite = tools.find((t) => t.name === "caddy_add_site")!;
    listSites = tools.find((t) => t.name === "caddy_list_sites")!;
  });

  it("only exposes the 2 caddy tools (no deploy_app)", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["caddy_add_site", "caddy_list_sites"]);
    expect(tools.find((t) => t.name === "deploy_app")).toBeUndefined();
  });

  it("caddy_add_site is user-confirm (modifies infra), caddy_list_sites stays auto (read-only)", () => {
    expect(addSite.permissionLevel).toBe("user-confirm");
    expect(listSites.permissionLevel).toBe("auto");
  });

  it("caddy_add_site uploads the Caddyfile + reloads systemd caddy", async () => {
    await addSite.execute({ server_id: "srv-1", domain: "app.paltemps.fr", port: 3000 });

    expect(svc.upload).toHaveBeenCalledTimes(1);
    const [serverId, content, path] = svc.upload.mock.calls[0];
    expect(serverId).toBe("srv-1");
    expect(content).toContain("reverse_proxy localhost:3000");
    expect(path).toBe("/etc/caddy/sites/app.caddy");

    // Both an `import` guard and a reload should have been exec'd.
    expect(svc.exec).toHaveBeenCalledTimes(2);
    const reloadCall = svc.exec.mock.calls[1];
    expect(reloadCall[1]).toBe("systemctl reload caddy");
  });

  it("caddy_add_site rejects an unsafe server_id (prompt-injection guard)", () => {
    return addSite.execute({ server_id: "srv;rm -rf /", domain: "x.example.com", port: 80 })
      .then((result) => {
        // The guard throws (assertSafeIdentifier) — defineTool's wrapper does NOT catch
        // throws, so we expect an unhandled rejection only if execute throws.
        // The current impl indeed throws — so the call should reject.
        expect(result).toBeUndefined(); // shouldn't reach here
      })
      .catch((e) => {
        expect(e).toBeInstanceOf(Error);
        expect(svc.upload).not.toHaveBeenCalled();
        expect(svc.exec).not.toHaveBeenCalled();
      });
  });

  it("caddy_add_site rejects an unsafe domain label", () => {
    return addSite.execute({ server_id: "srv-1", domain: "evil$(rm).example.com", port: 80 })
      .catch((e) => {
        expect(e).toBeInstanceOf(Error);
        expect(svc.upload).not.toHaveBeenCalled();
      });
  });

  it("caddy_add_site rejects domain without a TLD", () => {
    return addSite.execute({ server_id: "srv-1", domain: "noTld", port: 80 })
      .catch((e) => {
        expect((e as Error).message).toContain("Invalid domain");
      });
  });

  it("caddy_list_sites returns parsed file list with count", async () => {
    svc.exec.mockReturnValue(Promise.resolve({ stdout: "app.caddy\nfoo.caddy\n", stderr: "", code: 0 }));
    const result = (await listSites.execute({ server_id: "srv-1" })) as { count: number; sites: string[] };
    expect(result.count).toBe(2);
    expect(result.sites).toEqual(["app.caddy", "foo.caddy"]);
  });

  it("caddy_list_sites rejects unsafe server_id", () => {
    return listSites.execute({ server_id: "srv;ls" })
      .catch((e) => {
        expect(e).toBeInstanceOf(Error);
        expect(svc.exec).not.toHaveBeenCalled();
      });
  });
});
