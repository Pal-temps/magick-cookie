import { describe, it, expect, mock } from "bun:test";
import { DeployService } from "../../application/deploy/deploy.service";

// Mock dependencies
function makeMockDns() {
  return {
    createRecord: mock(() => Promise.resolve({ id: "rec-1", type: "A", name: "app", content: "1.2.3.4", ttl: 300, provider: "ovh" })),
    deleteRecord: mock(() => Promise.resolve()),
    listRecords: mock(() => Promise.resolve([])),
    getZones: mock(() => Promise.resolve([])),
    detectProvider: mock(() => Promise.resolve(null)),
  };
}

function makeMockSsh() {
  return {
    exec: mock(() => Promise.resolve({ stdout: "", stderr: "", code: 0 })),
    upload: mock(() => Promise.resolve()),
    listServers: mock(() => []),
    addServer: mock(() => ({})),
    removeServer: mock(() => true),
    getServer: mock(() => undefined),
  };
}

describe("DeployService", () => {
  it("deploy yields DNS step first", async () => {
    const dns = makeMockDns();
    const ssh = makeMockSsh();
    const service = new DeployService(dns as any, ssh as any);

    const steps = [];
    for await (const step of service.deploy({
      appName: "test-app",
      subdomain: "test",
      zone: "paltemps.fr",
      serverIp: "1.2.3.4",
      serverId: "srv-1",
      repoUrl: "https://github.com/test/repo.git",
      buildCommand: "npm run build",
      startCommand: "pm2 start npm --name test-app -- start",
      appPort: 3000,
    })) {
      steps.push(step);
    }

    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].step).toBe("dns");
    expect(steps[0].status).toBe("running");

    // DNS create should have been called
    expect(dns.createRecord).toHaveBeenCalledTimes(1);
  });

  it("deploy handles DNS error gracefully", async () => {
    const dns = makeMockDns();
    dns.createRecord = mock(() => Promise.reject(new Error("DNS API down")));
    const ssh = makeMockSsh();
    const service = new DeployService(dns as any, ssh as any);

    const steps = [];
    for await (const step of service.deploy({
      appName: "fail-app",
      subdomain: "fail",
      zone: "paltemps.fr",
      serverIp: "1.2.3.4",
      serverId: "srv-1",
      repoUrl: "https://github.com/test/repo.git",
      buildCommand: "npm run build",
      startCommand: "pm2 start",
      appPort: 3000,
    })) {
      steps.push(step);
    }

    // Should have dns running then dns error, then stop
    const dnsSteps = steps.filter((s) => s.step === "dns");
    expect(dnsSteps.length).toBe(2);
    expect(dnsSteps[1].status).toBe("error");
    expect(dnsSteps[1].message).toContain("DNS API down");

    // Should NOT have proceeded to clone
    expect(steps.find((s) => s.step === "clone")).toBeUndefined();
  });

  it("deploy with gitProvider=vps-bare creates repo and skips clone/build", async () => {
    const dns = makeMockDns();
    const ssh = makeMockSsh();
    const mockGitRemote = {
      createRepo: mock(() => Promise.resolve({ name: "app", provider: "vps-bare", cloneUrl: "root@vps:/opt/git/app.git" })),
    };
    const service = new DeployService(dns as any, ssh as any, mockGitRemote as any);

    const steps = [];
    for await (const step of service.deploy({
      appName: "git-app",
      subdomain: "git",
      zone: "paltemps.fr",
      serverIp: "1.2.3.4",
      serverId: "srv-1",
      gitProvider: "vps-bare",
      buildCommand: "npm run build",
      startCommand: "pm2 start",
      appPort: 3000,
    })) {
      steps.push(step);
    }

    expect(mockGitRemote.createRepo).toHaveBeenCalledTimes(1);
    // Should have repo step, caddy step, verify — but no clone/build
    expect(steps.some((s) => s.step === "repo")).toBe(true);
    expect(steps.some((s) => s.step === "clone")).toBe(false);
    expect(steps.some((s) => s.step === "build")).toBe(false);
  });
});
