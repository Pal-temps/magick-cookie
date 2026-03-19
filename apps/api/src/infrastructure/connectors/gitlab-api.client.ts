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
}
