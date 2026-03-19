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
}
