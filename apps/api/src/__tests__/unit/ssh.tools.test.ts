import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createSshTools } from "../../application/agent/tools/ssh.tools";
import type { SshService } from "../../infrastructure/ssh/ssh.service";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("ssh.tools", () => {
  let svc: { [K in keyof SshService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listTool: AgentTool;
  let addTool: AgentTool;
  let execTool: AgentTool;
  let uploadTool: AgentTool;

  beforeEach(() => {
    svc = {
      listServers: mock(() => []),
      addServer: mock(() => ({ id: "srv-1" } as never)),
      getServer: mock(() => undefined),
      exec: mock(() => Promise.resolve({ stdout: "", stderr: "", code: 0 })),
      upload: mock(() => Promise.resolve()),
    } as unknown as { [K in keyof SshService]: ReturnType<typeof mock> };

    tools = createSshTools(svc as unknown as SshService);
    listTool = tools.find((t) => t.name === "server_list")!;
    addTool = tools.find((t) => t.name === "server_add")!;
    execTool = tools.find((t) => t.name === "ssh_exec")!;
    uploadTool = tools.find((t) => t.name === "ssh_upload")!;
  });

  it("registers 4 tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(["server_add", "server_list", "ssh_exec", "ssh_upload"]);
  });

  it("server_list wraps with count", async () => {
    svc.listServers.mockReturnValue([{ id: "a" }, { id: "b" }] as never);
    const result = (await listTool.execute({})) as { count: number };
    expect(result.count).toBe(2);
  });

  it("server_add fills defaults port=22 and authMethod=key", async () => {
    await addTool.execute({ label: "VPS", host: "1.2.3.4", user: "root" });
    const arg = svc.addServer.mock.calls[0][0] as { port: number; authMethod: string };
    expect(arg.port).toBe(22);
    expect(arg.authMethod).toBe("key");
  });

  it("server_add forwards explicit port + auth_method=password", async () => {
    await addTool.execute({ label: "VPS", host: "1.2.3.4", user: "deploy", port: 2222, auth_method: "password" });
    const arg = svc.addServer.mock.calls[0][0] as { port: number; authMethod: string };
    expect(arg.port).toBe(2222);
    expect(arg.authMethod).toBe("password");
  });

  it("ssh_exec truncates stdout > 5000 chars and reports it", async () => {
    const big = "x".repeat(8000);
    svc.exec.mockReturnValue(Promise.resolve({ stdout: big, stderr: "", code: 0 }));
    const result = (await execTool.execute({ server_id: "srv", command: "echo hi" })) as { stdout: string; truncated: boolean; exit_code: number };
    expect(result.stdout).toHaveLength(5000);
    expect(result.truncated).toBe(true);
    expect(result.exit_code).toBe(0);
  });

  it("ssh_exec marks truncated=false for short output", async () => {
    svc.exec.mockReturnValue(Promise.resolve({ stdout: "ok", stderr: "", code: 0 }));
    const result = (await execTool.execute({ server_id: "srv", command: "ls" })) as { truncated: boolean };
    expect(result.truncated).toBe(false);
  });

  it("ssh_upload forwards all 3 args", async () => {
    await uploadTool.execute({ server_id: "srv", content: "hello", remote_path: "/tmp/x" });
    expect(svc.upload).toHaveBeenCalledWith("srv", "hello", "/tmp/x");
  });

  it("ssh_upload rejects empty server_id via zod", async () => {
    const result = (await uploadTool.execute({ server_id: "", content: "x", remote_path: "/tmp" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.upload).not.toHaveBeenCalled();
  });
});
