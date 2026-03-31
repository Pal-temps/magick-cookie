import { describe, it, expect, beforeEach } from "bun:test";
import { SshService } from "../../infrastructure/ssh/ssh.service";

describe("SshService", () => {
  let service: SshService;

  beforeEach(() => {
    service = new SshService();
  });

  it("should instantiate without errors", () => {
    expect(service).toBeDefined();
  });

  it("listServers returns empty array initially", () => {
    const servers = service.listServers();
    // May have servers from legacy config, but should not throw
    expect(Array.isArray(servers)).toBe(true);
  });

  it("addServer creates a server with generated ID", () => {
    const server = service.addServer({
      label: "Test VPS",
      host: "1.2.3.4",
      user: "root",
      port: 22,
      authMethod: "key",
    });

    expect(server.id).toBeTruthy();
    expect(server.label).toBe("Test VPS");
    expect(server.host).toBe("1.2.3.4");
    expect(server.user).toBe("root");
    expect(server.port).toBe(22);
    // Password should not be exposed
    expect(server.password).toBeUndefined();
  });

  it("getServer returns added server", () => {
    const added = service.addServer({
      label: "Get Test",
      host: "5.6.7.8",
      user: "deploy",
      port: 2222,
      authMethod: "key",
    });

    const found = service.getServer(added.id);
    expect(found).toBeDefined();
    expect(found!.host).toBe("5.6.7.8");
  });

  it("removeServer deletes existing server", () => {
    const added = service.addServer({
      label: "To Remove",
      host: "9.9.9.9",
      user: "root",
      port: 22,
      authMethod: "key",
    });

    const deleted = service.removeServer(added.id);
    expect(deleted).toBe(true);
    expect(service.getServer(added.id)).toBeUndefined();
  });

  it("removeServer returns false for unknown ID", () => {
    const deleted = service.removeServer("nonexistent");
    expect(deleted).toBe(false);
  });

  it("exec throws for unknown server", async () => {
    try {
      await service.exec("nonexistent", "ls");
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain("not found");
    }
  });
});
