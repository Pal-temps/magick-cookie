import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createGitRemoteTools } from "../../application/agent/tools/git-remote.tools";
import type { GitRemoteService } from "../../infrastructure/git-remote/git-remote.service";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("git-remote.tools", () => {
  let svc: { [K in keyof GitRemoteService]: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let providersTool: AgentTool;
  let listTool: AgentTool;
  let createTool: AgentTool;
  let deleteTool: AgentTool;

  beforeEach(() => {
    svc = {
      availableProviders: mock(() => []),
      listRepos: mock(() => Promise.resolve([])),
      createRepo: mock(() => Promise.resolve({ provider: "github", cloneUrl: "https://x", webUrl: "https://x" } as never)),
      deleteRepo: mock(() => Promise.resolve()),
      getAdapter: mock(() => ({} as never)),
    } as unknown as { [K in keyof GitRemoteService]: ReturnType<typeof mock> };

    tools = createGitRemoteTools(svc as unknown as GitRemoteService);
    providersTool = tools.find((t) => t.name === "git_remote_providers")!;
    listTool = tools.find((t) => t.name === "git_remote_list")!;
    createTool = tools.find((t) => t.name === "git_remote_create")!;
    deleteTool = tools.find((t) => t.name === "git_remote_delete")!;
  });

  it("registers 4 tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "git_remote_create", "git_remote_delete", "git_remote_list", "git_remote_providers",
    ]);
  });

  it("git_remote_providers returns the service list", async () => {
    svc.availableProviders.mockReturnValue(["vps-bare", "github"]);
    const result = (await providersTool.execute({})) as { providers: string[] };
    expect(result.providers).toEqual(["vps-bare", "github"]);
  });

  it("git_remote_list wraps repos with count", async () => {
    svc.listRepos.mockReturnValue(Promise.resolve([{ name: "a" }, { name: "b" }] as never));
    const result = (await listTool.execute({})) as { count: number };
    expect(result.count).toBe(2);
  });

  it("git_remote_create maps snake_case params to the service camelCase shape", async () => {
    svc.createRepo.mockReturnValue(Promise.resolve({
      name: "my-app", provider: "vps-bare", cloneUrl: "ssh://x/repo.git", serverId: "srv-1",
    } as never));
    const result = (await createTool.execute({
      provider: "vps-bare", name: "my-app", server_id: "srv-1",
      build_command: "npm run build", start_command: "pm2 start app",
      description: "my app", private: true,
    })) as { created: boolean; instructions: string };

    expect(result.created).toBe(true);
    expect(result.instructions).toContain("git remote add vps");
    const [provider, opts] = svc.createRepo.mock.calls[0];
    expect(provider).toBe("vps-bare");
    expect(opts).toEqual({
      name: "my-app", serverId: "srv-1",
      buildCommand: "npm run build", startCommand: "pm2 start app",
      description: "my app", private: true,
    });
  });

  it("git_remote_create returns the github/gitlab instructions branch when provider is hosted", async () => {
    svc.createRepo.mockReturnValue(Promise.resolve({
      name: "x", provider: "github", cloneUrl: "git@github.com:u/x.git", webUrl: "https://github.com/u/x",
    } as never));
    const result = (await createTool.execute({ provider: "github", name: "x" })) as { instructions: string };
    expect(result.instructions).toContain("github");
    expect(result.instructions).not.toContain("git remote add vps");
  });

  it("git_remote_create rejects unknown provider via zod", async () => {
    const result = (await createTool.execute({ provider: "bitbucket", name: "x" })) as { error?: string };
    expect(result.error).toBe("Parametres invalides");
    expect(svc.createRepo).not.toHaveBeenCalled();
  });

  it("git_remote_delete forwards provider + name", async () => {
    await deleteTool.execute({ provider: "github", name: "x" });
    expect(svc.deleteRepo).toHaveBeenCalledWith("github", "x");
  });
});
