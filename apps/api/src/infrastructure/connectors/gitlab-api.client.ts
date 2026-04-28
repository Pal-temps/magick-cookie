export interface GitLabComment {
  id: string;
  commentText: string;
  user: { username: string; initials: string };
  date: string;
}

export interface GitLabIssue {
  iid: number;
  projectId: number;
  projectName: string;
  title: string;
  description: string | null;
  state: string;
  webUrl: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  dueDate: Date | null;
  boardColumn: string | null;
}

interface RawGitLabIssue {
  iid: number;
  title: string;
  description: string | null;
  state: string;
  web_url: string;
  labels: string[];
  assignees: { username: string }[];
  milestone: { title: string } | null;
  due_date: string | null;
}

interface RawGitLabProject {
  id: number;
  name: string;
}

interface RawGitLabNote {
  id: number;
  body: string;
  author: { username: string };
  created_at: string;
  system: boolean;
}

interface RawGitLabBoard {
  id: number;
  lists: { id: number; label: { name: string } }[];
}

export interface GitLabProject {
  id: number;
  pathWithNamespace: string;
  description: string | null;
  visibility: string;
  webUrl: string;
  defaultBranch: string;
  openIssuesCount: number;
}

export interface GitLabMergeRequest {
  iid: number;
  projectId: number;
  title: string;
  state: string;
  webUrl: string;
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  author: string;
}

export class GitLabApiClient {
  constructor(private token: string, private baseUrl = "https://gitlab.com") {}

  async fetchIssues(projectIds: number[]): Promise<GitLabIssue[]> {
    const all: GitLabIssue[] = [];
    for (const projectId of projectIds) {
      const project = await this.fetchProject(projectId);
      const boardLabels = await this.fetchBoardLabels(projectId);
      const issues = await this.fetchProjectIssues(projectId, project.name, boardLabels);
      all.push(...issues);
    }
    return all;
  }

  async fetchIssueDetail(projectId: number, iid: number): Promise<{ description: string | null }> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/issues/${iid}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitLab API error (GET issue ${projectId}#${iid}): ${res.status}`);
    const data = (await res.json()) as RawGitLabIssue;
    return { description: data.description };
  }

  async fetchIssueNotes(projectId: number, iid: number): Promise<GitLabComment[]> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/issues/${iid}/notes?per_page=100`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitLab API error (GET notes): ${res.status}`);
    const data = (await res.json()) as RawGitLabNote[];
    return data
      .filter((n) => !n.system)
      .map((n) => ({
        id: String(n.id),
        commentText: n.body,
        user: { username: n.author.username, initials: n.author.username.slice(0, 2).toUpperCase() },
        date: n.created_at,
      }));
  }

  private async fetchProject(projectId: number): Promise<{ id: number; name: string }> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitLab API error (GET project ${projectId}): ${res.status}`);
    const data = (await res.json()) as RawGitLabProject;
    return { id: data.id, name: data.name };
  }

  private async fetchBoardLabels(projectId: number): Promise<Map<string, string>> {
    const labelToColumn = new Map<string, string>();
    try {
      const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/boards`, {
        headers: this.headers(),
      });
      if (!res.ok) return labelToColumn;
      const boards = (await res.json()) as RawGitLabBoard[];
      if (boards.length === 0) return labelToColumn;

      const board = boards[0];
      if (board.lists) {
        for (const list of board.lists) {
          if (list.label) {
            labelToColumn.set(list.label.name, list.label.name);
          }
        }
      }
    } catch {
      // Board fetching is optional
    }
    return labelToColumn;
  }

  private async fetchProjectIssues(
    projectId: number,
    projectName: string,
    boardLabels: Map<string, string>,
  ): Promise<GitLabIssue[]> {
    const issues: GitLabIssue[] = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `${this.baseUrl}/api/v4/projects/${projectId}/issues?state=opened&per_page=100&page=${page}`,
        { headers: this.headers() },
      );
      if (!res.ok) throw new Error(`GitLab API error (GET issues project ${projectId}): ${res.status}`);

      const data = (await res.json()) as RawGitLabIssue[];
      if (data.length === 0) break;

      for (const raw of data) {
        const boardColumn = raw.labels.find((l) => boardLabels.has(l)) ?? null;
        issues.push({
          iid: raw.iid,
          projectId,
          projectName,
          title: raw.title,
          description: raw.description,
          state: raw.state,
          webUrl: raw.web_url,
          labels: raw.labels,
          assignees: raw.assignees.map((a) => a.username),
          milestone: raw.milestone?.title ?? null,
          dueDate: raw.due_date ? new Date(raw.due_date) : null,
          boardColumn,
        });
      }

      page++;
    }

    return issues;
  }

  private headers() {
    return {
      "PRIVATE-TOKEN": this.token,
    };
  }

  // ─── Write operations (Phase 5 of the AI plan) ───

  async listProjects(membership: boolean = true): Promise<GitLabProject[]> {
    // membership=true → only projects the user is a member of (sane default).
    const res = await fetch(`${this.baseUrl}/api/v4/projects?membership=${membership}&per_page=100&order_by=last_activity_at`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitLab API error (GET /projects): ${res.status}`);
    const raw = (await res.json()) as Array<{
      id: number;
      path_with_namespace: string;
      description: string | null;
      visibility: string;
      web_url: string;
      default_branch: string;
      open_issues_count?: number;
    }>;
    return raw.map((p) => ({
      id: p.id,
      pathWithNamespace: p.path_with_namespace,
      description: p.description,
      visibility: p.visibility,
      webUrl: p.web_url,
      defaultBranch: p.default_branch,
      openIssuesCount: p.open_issues_count ?? 0,
    }));
  }

  async createIssue(projectId: number, input: { title: string; description?: string; labels?: string[]; assigneeIds?: number[] }): Promise<{ iid: number; webUrl: string }> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/issues`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        labels: input.labels?.join(","),
        assignee_ids: input.assigneeIds,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitLab API error (POST issue ${projectId}): ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { iid: number; web_url: string };
    return { iid: data.iid, webUrl: data.web_url };
  }

  async closeIssue(projectId: number, iid: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/issues/${iid}?state_event=close`, {
      method: "PUT",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`GitLab API error (PUT issue ${projectId}#${iid}): ${res.status}`);
    }
  }

  async addIssueComment(projectId: number, iid: number, body: string): Promise<{ id: number }> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/issues/${iid}/notes`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitLab API error (POST issue note): ${res.status}`);
    }
    const data = (await res.json()) as { id: number };
    return { id: data.id };
  }

  async triggerPipeline(projectId: number, ref: string, variables?: Record<string, string>): Promise<{ id: number; webUrl: string }> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/pipeline`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref,
        variables: variables
          ? Object.entries(variables).map(([key, value]) => ({ key, value }))
          : undefined,
      }),
    });
    if (!res.ok) {
      throw new Error(`GitLab API error (POST pipeline): ${res.status}`);
    }
    const data = (await res.json()) as { id: number; web_url: string };
    return { id: data.id, webUrl: data.web_url };
  }

  async listMergeRequests(projectId: number, state: "opened" | "closed" | "merged" | "all" = "opened"): Promise<GitLabMergeRequest[]> {
    const res = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/merge_requests?state=${state}&per_page=100`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitLab API error (GET MRs ${projectId}): ${res.status}`);
    const raw = (await res.json()) as Array<{
      iid: number;
      title: string;
      state: string;
      web_url: string;
      draft: boolean;
      source_branch: string;
      target_branch: string;
      author: { username: string };
    }>;
    return raw.map((m) => ({
      iid: m.iid,
      projectId,
      title: m.title,
      state: m.state,
      webUrl: m.web_url,
      isDraft: m.draft,
      sourceBranch: m.source_branch,
      targetBranch: m.target_branch,
      author: m.author.username,
    }));
  }

  /**
   * GitLab equivalent of "review a PR": post a note on the MR. Approving an MR is
   * a separate API path, so we accept an explicit `approve` flag that hits
   * `/merge_requests/:iid/approve` after the comment posts.
   */
  async reviewMergeRequest(projectId: number, iid: number, body: string, approve: boolean): Promise<{ noteId: number; approved: boolean }> {
    const noteRes = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${iid}/notes`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!noteRes.ok) {
      throw new Error(`GitLab API error (POST MR note): ${noteRes.status}`);
    }
    const note = (await noteRes.json()) as { id: number };

    if (approve) {
      const approveRes = await fetch(`${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${iid}/approve`, {
        method: "POST",
        headers: this.headers(),
      });
      if (!approveRes.ok) {
        throw new Error(`GitLab API error (POST MR approve): ${approveRes.status}`);
      }
    }
    return { noteId: note.id, approved: approve };
  }
}
