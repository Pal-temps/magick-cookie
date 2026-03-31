import { describe, it, expect, mock } from "bun:test";
import { GitRemoteService } from "../../infrastructure/git-remote/git-remote.service";

describe("GitRemoteService", () => {
  function makeMockSsh() {
    return {
      exec: mock(() => Promise.resolve({ stdout: "", stderr: "", code: 0 })),
      upload: mock(() => Promise.resolve()),
      listServers: mock(() => [{ id: "srv-1", label: "Test", host: "1.2.3.4", port: 22, user: "root", authMethod: "key" }]),
      addServer: mock(() => ({})),
      removeServer: mock(() => true),
      getServer: mock((id: string) => id === "srv-1" ? { id: "srv-1", label: "Test", host: "1.2.3.4", port: 22, user: "root", authMethod: "key" } : undefined),
    };
  }

  it("availableProviders always includes vps-bare", () => {
    const ssh = makeMockSsh();
    const service = new GitRemoteService(ssh as any);
    const providers = service.availableProviders();
    expect(providers).toContain("vps-bare");
  });

  it("getAdapter returns vps-bare adapter", () => {
    const ssh = makeMockSsh();
    const service = new GitRemoteService(ssh as any);
    const adapter = service.getAdapter("vps-bare");
    expect(adapter.provider).toBe("vps-bare");
  });

  it("getAdapter throws for unconfigured provider", () => {
    const ssh = makeMockSsh();
    const service = new GitRemoteService(ssh as any);
    try {
      service.getAdapter("github");
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain("not available");
    }
  });

  it("createRepo via vps-bare creates bare repo with hook", async () => {
    const ssh = makeMockSsh();
    const service = new GitRemoteService(ssh as any);

    const repo = await service.createRepo("vps-bare", {
      name: "test-app",
      serverId: "srv-1",
      buildCommand: "npm run build",
      startCommand: "pm2 restart test-app",
    });

    expect(repo.name).toBe("test-app");
    expect(repo.provider).toBe("vps-bare");
    expect(repo.cloneUrl).toContain("root@1.2.3.4");
    expect(repo.cloneUrl).toContain("test-app.git");

    // Should have called exec for git init --bare
    expect(ssh.exec).toHaveBeenCalled();
    // Should have called upload for the post-receive hook
    expect(ssh.upload).toHaveBeenCalled();
  });

  it("createRepo vps-bare throws without serverId", async () => {
    const ssh = makeMockSsh();
    const service = new GitRemoteService(ssh as any);

    try {
      await service.createRepo("vps-bare", { name: "no-server" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain("serverId required");
    }
  });
});
