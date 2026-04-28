export interface GitHubComment {
  id: string;
  commentText: string;
  user: { username: string; initials: string };
  date: string;
}

export interface GitHubIssue {
  number: number;
  repo: string;
  title: string;
  body: string | null;
  state: string;
  url: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  dueDate: Date | null;
  isPR: boolean;
}

interface RawGitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  labels: { name: string }[];
  assignees: { login: string }[];
  milestone: { title: string; due_on: string | null } | null;
  pull_request?: unknown;
  user: { login: string };
}

interface RawGitHubComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
}

export interface GitHubRepo {
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  url: string;
  defaultBranch: string;
  openIssuesCount: number;
}

export interface GitHubPullRequest {
  number: number;
  repo: string;
  title: string;
  state: string;
  url: string;
  isDraft: boolean;
  baseBranch: string;
  headBranch: string;
  author: string;
}

export type GitHubReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export class GitHubApiClient {
  private baseUrl = "https://api.github.com";

  constructor(private token: string, private username: string) {}

  async fetchIssues(repos: string[]): Promise<GitHubIssue[]> {
    const all: GitHubIssue[] = [];
    for (const repo of repos) {
      const issues = await this.fetchRepoIssues(repo, false);
      all.push(...issues);
    }
    return all;
  }

  async fetchPRsAsIssues(repos: string[]): Promise<GitHubIssue[]> {
    const all: GitHubIssue[] = [];
    for (const repo of repos) {
      const prs = await this.fetchRepoIssues(repo, true);
      all.push(...prs);
    }
    return all;
  }

  async fetchIssueDetail(repo: string, number: number): Promise<{ body: string | null }> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/issues/${number}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error (GET /repos/${repo}/issues/${number}): ${res.status}`);
    const data = (await res.json()) as RawGitHubIssue;
    return { body: data.body };
  }

  async fetchIssueComments(repo: string, number: number): Promise<GitHubComment[]> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/issues/${number}/comments?per_page=100`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error (GET comments): ${res.status}`);
    const data = (await res.json()) as RawGitHubComment[];
    return data.map((c) => ({
      id: String(c.id),
      commentText: c.body,
      user: { username: c.user.login, initials: c.user.login.slice(0, 2).toUpperCase() },
      date: c.created_at,
    }));
  }

  private async fetchRepoIssues(repo: string, onlyPRs: boolean): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    let page = 1;

    while (true) {
      const url = `${this.baseUrl}/repos/${repo}/issues?state=open&assignee=${this.username}&per_page=100&page=${page}`;
      const res = await fetch(url, { headers: this.headers() });

      if (res.status === 403 || res.status === 429) {
        console.warn(`[github-api] Rate limited on ${repo}, stopping.`);
        break;
      }
      if (!res.ok) throw new Error(`GitHub API error (GET ${repo}/issues): ${res.status}`);

      const data = (await res.json()) as RawGitHubIssue[];
      if (data.length === 0) break;

      for (const raw of data) {
        const isPR = !!raw.pull_request;
        if (onlyPRs && !isPR) continue;
        if (!onlyPRs && isPR) continue;

        issues.push({
          number: raw.number,
          repo,
          title: raw.title,
          body: raw.body,
          state: raw.state,
          url: raw.html_url,
          labels: raw.labels.map((l) => l.name),
          assignees: raw.assignees.map((a) => a.login),
          milestone: raw.milestone?.title ?? null,
          dueDate: raw.milestone?.due_on ? new Date(raw.milestone.due_on) : null,
          isPR,
        });
      }

      page++;
    }

    return issues;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  // ─── Write operations (Phase 5 of the AI plan) ───

  async listRepos(): Promise<GitHubRepo[]> {
    // /user/repos returns repos accessible to the authenticated user (owned + collaborator).
    const res = await fetch(`${this.baseUrl}/user/repos?per_page=100&sort=updated`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error (GET /user/repos): ${res.status}`);
    const raw = (await res.json()) as Array<{
      full_name: string;
      description: string | null;
      private: boolean;
      html_url: string;
      default_branch: string;
      open_issues_count: number;
    }>;
    return raw.map((r) => ({
      fullName: r.full_name,
      description: r.description,
      isPrivate: r.private,
      url: r.html_url,
      defaultBranch: r.default_branch,
      openIssuesCount: r.open_issues_count,
    }));
  }

  async createIssue(repo: string, input: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<{ number: number; url: string }> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/issues`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: input.labels,
        assignees: input.assignees,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error (POST /repos/${repo}/issues): ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { number: number; html_url: string };
    return { number: data.number, url: data.html_url };
  }

  async closeIssue(repo: string, number: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/issues/${number}`, {
      method: "PATCH",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed" }),
    });
    if (!res.ok) {
      throw new Error(`GitHub API error (PATCH /repos/${repo}/issues/${number}): ${res.status}`);
    }
  }

  async addIssueComment(repo: string, number: number, body: string): Promise<{ id: number; url: string }> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/issues/${number}/comments`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitHub API error (POST issue comment): ${res.status}`);
    }
    const data = (await res.json()) as { id: number; html_url: string };
    return { id: data.id, url: data.html_url };
  }

  async triggerWorkflow(repo: string, workflowId: string | number, ref: string, inputs?: Record<string, string>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ ref, inputs }),
    });
    if (!res.ok) {
      throw new Error(`GitHub API error (POST workflow dispatch): ${res.status}`);
    }
  }

  async listPullRequests(repo: string, state: "open" | "closed" | "all" = "open"): Promise<GitHubPullRequest[]> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/pulls?state=${state}&per_page=100`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error (GET /repos/${repo}/pulls): ${res.status}`);
    const raw = (await res.json()) as Array<{
      number: number;
      title: string;
      state: string;
      html_url: string;
      draft: boolean;
      base: { ref: string };
      head: { ref: string };
      user: { login: string };
    }>;
    return raw.map((p) => ({
      number: p.number,
      repo,
      title: p.title,
      state: p.state,
      url: p.html_url,
      isDraft: p.draft,
      baseBranch: p.base.ref,
      headBranch: p.head.ref,
      author: p.user.login,
    }));
  }

  async reviewPullRequest(repo: string, number: number, event: GitHubReviewEvent, body?: string): Promise<{ id: number }> {
    const res = await fetch(`${this.baseUrl}/repos/${repo}/pulls/${number}/reviews`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ event, body }),
    });
    if (!res.ok) {
      throw new Error(`GitHub API error (POST PR review): ${res.status}`);
    }
    const data = (await res.json()) as { id: number };
    return { id: data.id };
  }
}
