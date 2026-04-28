import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createGitHubTools } from "../../application/agent/tools/github.tools";
import type { ProviderService } from "../../application/provider/provider.service";
import type { GitHubApiClient } from "../../infrastructure/connectors/github-api.client";
import type { AgentTool } from "../../application/agent/tool-registry";

describe("github.tools", () => {
  let client: { [K in keyof GitHubApiClient]: ReturnType<typeof mock> };
  let provider: { getGitHubClient: ReturnType<typeof mock> };
  let tools: AgentTool[];
  let listRepos: AgentTool;
  let createIssue: AgentTool;
  let closeIssue: AgentTool;
  let addComment: AgentTool;
  let triggerWorkflow: AgentTool;
  let listPrs: AgentTool;
  let reviewPr: AgentTool;

  beforeEach(() => {
    client = {
      listRepos: mock(() => Promise.resolve([])),
      createIssue: mock(() => Promise.resolve({ number: 42, url: "https://github.com/o/r/issues/42" })),
      closeIssue: mock(() => Promise.resolve()),
      addIssueComment: mock(() => Promise.resolve({ id: 1, url: "u" })),
      triggerWorkflow: mock(() => Promise.resolve()),
      listPullRequests: mock(() => Promise.resolve([])),
      reviewPullRequest: mock(() => Promise.resolve({ id: 99 })),
      fetchIssues: mock(() => Promise.resolve([])),
      fetchPRsAsIssues: mock(() => Promise.resolve([])),
      fetchIssueDetail: mock(() => Promise.resolve({ body: null })),
      fetchIssueComments: mock(() => Promise.resolve([])),
    } as unknown as { [K in keyof GitHubApiClient]: ReturnType<typeof mock> };

    provider = { getGitHubClient: mock(() => Promise.resolve(client)) };

    tools = createGitHubTools(provider as unknown as ProviderService);
    listRepos = tools.find((t) => t.name === "github_list_repos")!;
    createIssue = tools.find((t) => t.name === "github_create_issue")!;
    closeIssue = tools.find((t) => t.name === "github_close_issue")!;
    addComment = tools.find((t) => t.name === "github_add_comment")!;
    triggerWorkflow = tools.find((t) => t.name === "github_trigger_workflow")!;
    listPrs = tools.find((t) => t.name === "github_list_prs")!;
    reviewPr = tools.find((t) => t.name === "github_review_pr")!;
  });

  it("registers the 7 GitHub tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "github_add_comment",
      "github_close_issue",
      "github_create_issue",
      "github_list_prs",
      "github_list_repos",
      "github_review_pr",
      "github_trigger_workflow",
    ]);
  });

  it("only github_review_pr is user-confirm", () => {
    expect(reviewPr.permissionLevel).toBe("user-confirm");
    for (const t of [listRepos, createIssue, closeIssue, addComment, triggerWorkflow, listPrs]) {
      expect(t.permissionLevel).toBe("auto");
    }
  });

  it("returns the standard 'not configured' error when provider has no client", async () => {
    provider.getGitHubClient.mockReturnValue(Promise.resolve(null));
    const result = (await listRepos.execute({})) as { error?: string; provider?: string; configureUrl?: string };
    expect(result.error).toBe("Provider not configured");
    expect(result.provider).toBe("github");
    expect(result.configureUrl).toBe("settings/connectors");
  });

  describe("github_list_repos", () => {
    it("delegates and wraps with a count", async () => {
      client.listRepos.mockReturnValue(Promise.resolve([{ fullName: "o/r1" }, { fullName: "o/r2" }] as never));
      const result = (await listRepos.execute({})) as { count: number };
      expect(result.count).toBe(2);
    });
  });

  describe("github_create_issue", () => {
    it("forwards the full payload and returns number+url", async () => {
      const result = (await createIssue.execute({
        repo: "o/r",
        title: "Bug",
        body: "found it",
        labels: ["bug"],
        assignees: ["alice"],
      })) as { created: boolean; number: number; url: string };
      expect(result.created).toBe(true);
      expect(result.number).toBe(42);
      expect(client.createIssue).toHaveBeenCalledWith("o/r", { title: "Bug", body: "found it", labels: ["bug"], assignees: ["alice"] });
    });

    it("rejects an invalid repo slug via zod", async () => {
      const result = (await createIssue.execute({ repo: "no-slash", title: "X" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
      expect(client.createIssue).not.toHaveBeenCalled();
    });

    it("wraps a 4xx HTTP error from the client as { error }", async () => {
      client.createIssue.mockReturnValue(Promise.reject(new Error("HTTP 422")));
      const result = (await createIssue.execute({ repo: "o/r", title: "X" })) as { error?: string };
      expect(result.error).toContain("422");
    });
  });

  describe("github_close_issue", () => {
    it("delegates with repo + number", async () => {
      const result = (await closeIssue.execute({ repo: "o/r", number: 5 })) as { closed: boolean; number: number };
      expect(result.closed).toBe(true);
      expect(result.number).toBe(5);
      expect(client.closeIssue).toHaveBeenCalledWith("o/r", 5);
    });

    it("rejects non-positive number", async () => {
      const result = (await closeIssue.execute({ repo: "o/r", number: 0 })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("github_add_comment", () => {
    it("delegates with body", async () => {
      const result = (await addComment.execute({ repo: "o/r", number: 5, body: "looks good" })) as { added: boolean; commentId: number };
      expect(result.added).toBe(true);
      expect(result.commentId).toBe(1);
      expect(client.addIssueComment).toHaveBeenCalledWith("o/r", 5, "looks good");
    });

    it("rejects empty body via zod", async () => {
      const result = (await addComment.execute({ repo: "o/r", number: 5, body: "" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("github_trigger_workflow", () => {
    it("forwards inputs map", async () => {
      await triggerWorkflow.execute({ repo: "o/r", workflowId: "deploy.yml", ref: "main", inputs: { env: "prod" } });
      expect(client.triggerWorkflow).toHaveBeenCalledWith("o/r", "deploy.yml", "main", { env: "prod" });
    });

    it("works without inputs", async () => {
      await triggerWorkflow.execute({ repo: "o/r", workflowId: "ci.yml", ref: "main" });
      expect(client.triggerWorkflow).toHaveBeenCalledWith("o/r", "ci.yml", "main", undefined);
    });
  });

  describe("github_list_prs", () => {
    it("defaults state to 'open'", async () => {
      await listPrs.execute({ repo: "o/r" });
      expect(client.listPullRequests).toHaveBeenCalledWith("o/r", "open");
    });

    it("forwards explicit state=closed", async () => {
      await listPrs.execute({ repo: "o/r", state: "closed" });
      expect(client.listPullRequests).toHaveBeenCalledWith("o/r", "closed");
    });

    it("rejects invalid state via zod", async () => {
      const result = (await listPrs.execute({ repo: "o/r", state: "draft" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });

  describe("github_review_pr", () => {
    it("requires body when event=REQUEST_CHANGES", async () => {
      const result = (await reviewPr.execute({ repo: "o/r", number: 1, event: "REQUEST_CHANGES" })) as { error?: string };
      expect(result.error).toContain("body requis");
      expect(client.reviewPullRequest).not.toHaveBeenCalled();
    });

    it("submits an APPROVE review without body", async () => {
      const result = (await reviewPr.execute({ repo: "o/r", number: 1, event: "APPROVE" })) as { reviewed: boolean; reviewId: number };
      expect(result.reviewed).toBe(true);
      expect(result.reviewId).toBe(99);
      expect(client.reviewPullRequest).toHaveBeenCalledWith("o/r", 1, "APPROVE", undefined);
    });

    it("rejects unknown event via zod", async () => {
      const result = (await reviewPr.execute({ repo: "o/r", number: 1, event: "MERGE" })) as { error?: string };
      expect(result.error).toBe("Parametres invalides");
    });
  });
});
