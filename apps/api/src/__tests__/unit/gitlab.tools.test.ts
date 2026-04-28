import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createGitLabTools } from "../../application/agent/tools/gitlab.tools";
import type { ProviderService } from "../../application/provider/provider.service";
import type { GitLabApiClient } from "../../infrastructure/connectors/gitlab-api.client";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("gitlab.tools", () => {
  let client: { [K in keyof GitLabApiClient]: ReturnType<typeof mock> };
  let provider: { getGitLabClient: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listProjects: AgentTool;
  let createIssue: AgentTool;
  let closeIssue: AgentTool;
  let addComment: AgentTool;
  let triggerPipeline: AgentTool;
  let listMrs: AgentTool;
  let reviewMr: AgentTool;

  beforeEach(() => {
    client = {
      listProjects: mock(() => Promise.resolve([])),
      createIssue: mock(() => Promise.resolve({ iid: 7, webUrl: "https://gitlab.com/g/p/-/issues/7" })),
      closeIssue: mock(() => Promise.resolve()),
      addIssueComment: mock(() => Promise.resolve({ id: 1 })),
      triggerPipeline: mock(() => Promise.resolve({ id: 99, webUrl: "https://gitlab.com/g/p/pipelines/99" })),
      listMergeRequests: mock(() => Promise.resolve([])),
      reviewMergeRequest: mock(() => Promise.resolve({ noteId: 5, approved: false })),
      fetchIssues: mock(() => Promise.resolve([])),
      fetchIssueDetail: mock(() => Promise.resolve({ description: null })),
      fetchIssueNotes: mock(() => Promise.resolve([])),
    } as unknown as { [K in keyof GitLabApiClient]: ReturnType<typeof mock> };

    provider = { getGitLabClient: mock(() => Promise.resolve(client)) };

    tools = createGitLabTools(provider as unknown as ProviderService);
    listProjects = tools.find((t) => t.name === "gitlab_list_projects")!;
    createIssue = tools.find((t) => t.name === "gitlab_create_issue")!;
    closeIssue = tools.find((t) => t.name === "gitlab_close_issue")!;
    addComment = tools.find((t) => t.name === "gitlab_add_comment")!;
    triggerPipeline = tools.find((t) => t.name === "gitlab_trigger_pipeline")!;
    listMrs = tools.find((t) => t.name === "gitlab_list_mrs")!;
    reviewMr = tools.find((t) => t.name === "gitlab_review_mr")!;
  });

  it("registers the 7 GitLab tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "gitlab_add_comment",
      "gitlab_close_issue",
      "gitlab_create_issue",
      "gitlab_list_mrs",
      "gitlab_list_projects",
      "gitlab_review_mr",
      "gitlab_trigger_pipeline",
    ]);
  });

  it("only gitlab_review_mr is user-confirm", () => {
    expect(reviewMr.permissionLevel).toBe("user-confirm");
    for (const t of [listProjects, createIssue, closeIssue, addComment, triggerPipeline, listMrs]) {
      expect(t.permissionLevel).toBe("auto");
    }
  });

  it("returns the standard 'not configured' error when provider has no client", async () => {
    provider.getGitLabClient.mockReturnValue(Promise.resolve(null));
    const result = (await listProjects.execute({})) as { error?: string; provider?: string };
    expect(result.error).toBe("Provider not configured");
    expect(result.provider).toBe("gitlab");
  });

  describe("gitlab_list_projects", () => {
    it("defaults membership=true", async () => {
      await listProjects.execute({});
      expect(client.listProjects).toHaveBeenCalledWith(true);
    });

    it("forwards membership=false", async () => {
      await listProjects.execute({ membership: false });
      expect(client.listProjects).toHaveBeenCalledWith(false);
    });
  });

  describe("gitlab_create_issue", () => {
    it("forwards full payload and returns iid+url", async () => {
      const result = (await createIssue.execute({
        projectId: 42,
        title: "Bug",
        description: "found",
        labels: ["bug"],
        assigneeIds: [7],
      })) as { created: boolean; iid: number; url: string };
      expect(result.created).toBe(true);
      expect(result.iid).toBe(7);
      expect(client.createIssue).toHaveBeenCalledWith(42, { title: "Bug", description: "found", labels: ["bug"], assigneeIds: [7] });
    });

    it("rejects negative projectId via zod", async () => {
      const result = (await createIssue.execute({ projectId: 0, title: "X" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("gitlab_close_issue", () => {
    it("delegates with projectId + iid", async () => {
      const result = (await closeIssue.execute({ projectId: 42, iid: 7 })) as { closed: boolean };
      expect(result.closed).toBe(true);
      expect(client.closeIssue).toHaveBeenCalledWith(42, 7);
    });
  });

  describe("gitlab_add_comment", () => {
    it("delegates with body", async () => {
      const result = (await addComment.execute({ projectId: 42, iid: 7, body: "lgtm" })) as { added: boolean; noteId: number };
      expect(result.added).toBe(true);
      expect(result.noteId).toBe(1);
    });

    it("rejects empty body", async () => {
      const result = (await addComment.execute({ projectId: 42, iid: 7, body: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("gitlab_trigger_pipeline", () => {
    it("forwards variables", async () => {
      await triggerPipeline.execute({ projectId: 42, ref: "main", variables: { ENV: "prod" } });
      expect(client.triggerPipeline).toHaveBeenCalledWith(42, "main", { ENV: "prod" });
    });

    it("works without variables", async () => {
      await triggerPipeline.execute({ projectId: 42, ref: "main" });
      expect(client.triggerPipeline).toHaveBeenCalledWith(42, "main", undefined);
    });
  });

  describe("gitlab_list_mrs", () => {
    it("defaults state to 'opened'", async () => {
      await listMrs.execute({ projectId: 42 });
      expect(client.listMergeRequests).toHaveBeenCalledWith(42, "opened");
    });

    it("rejects unknown state via zod", async () => {
      const result = (await listMrs.execute({ projectId: 42, state: "draft" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("gitlab_review_mr", () => {
    it("posts a comment and approves when approve=true", async () => {
      client.reviewMergeRequest.mockReturnValue(Promise.resolve({ noteId: 5, approved: true }));
      const result = (await reviewMr.execute({ projectId: 42, iid: 7, body: "ok", approve: true })) as { reviewed: boolean; approved: boolean };
      expect(result.reviewed).toBe(true);
      expect(result.approved).toBe(true);
      expect(client.reviewMergeRequest).toHaveBeenCalledWith(42, 7, "ok", true);
    });

    it("defaults approve=false (just a comment)", async () => {
      await reviewMr.execute({ projectId: 42, iid: 7, body: "minor nit" });
      expect(client.reviewMergeRequest).toHaveBeenCalledWith(42, 7, "minor nit", false);
    });

    it("rejects empty body via zod", async () => {
      const result = (await reviewMr.execute({ projectId: 42, iid: 7, body: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });
});
