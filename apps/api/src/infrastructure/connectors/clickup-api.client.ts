export interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: Date | null;
  startDate: Date | null;
  url: string;
  listName: string;
  spaceName: string;
  priority: string | null;
  assignees: string[];
}

export interface ClickUpComment {
  id: string;
  commentText: string;
  user: { username: string; initials: string };
  date: string;
}

interface ClickUpRawComment {
  id: string;
  comment_text: string;
  user: { username: string; initials: string };
  date: string;
}

interface ClickUpRawTaskDetail {
  id: string;
  text_content: string | null;
  markdown_description: string | null;
  description: string | null;
}

interface ClickUpRawTask {
  id: string;
  name: string;
  description: string;
  status: { status: string };
  due_date: string | null;
  start_date: string | null;
  url: string;
  list: { name: string };
  space: { id: string };
  priority: { priority: string } | null;
  assignees: { username: string }[];
}

interface TeamsResponse {
  teams: { id: string; name: string }[];
}

interface TasksResponse {
  tasks: ClickUpRawTask[];
}

export class ClickUpApiClient {
  private baseUrl = "https://api.clickup.com/api/v2";

  constructor(private token: string) {}

  async fetchAllTasks(): Promise<ClickUpTask[]> {
    const userId = await this.fetchAuthenticatedUserId();
    const teams = await this.fetchTeams();
    const allTasks: ClickUpTask[] = [];

    for (const team of teams) {
      const tasks = await this.fetchTeamTasks(team.id, userId);
      allTasks.push(...tasks);
    }

    return allTasks;
  }

  async fetchTaskDetail(taskId: string): Promise<{ textContent: string | null; markdownDescription: string | null }> {
    const res = await fetch(`${this.baseUrl}/task/${taskId}`, {
      headers: { Authorization: this.token },
    });

    if (!res.ok) {
      throw new Error(`ClickUp API error (GET /task/${taskId}): ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as ClickUpRawTaskDetail;
    return {
      textContent: data.text_content || data.description || null,
      markdownDescription: data.markdown_description || null,
    };
  }

  async fetchTaskComments(taskId: string): Promise<ClickUpComment[]> {
    const res = await fetch(`${this.baseUrl}/task/${taskId}/comment`, {
      headers: { Authorization: this.token },
    });

    if (!res.ok) {
      throw new Error(`ClickUp API error (GET /task/${taskId}/comment): ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { comments: ClickUpRawComment[] };
    return data.comments.map((c) => ({
      id: c.id,
      commentText: c.comment_text,
      user: { username: c.user.username, initials: c.user.initials },
      date: c.date,
    }));
  }

  private async fetchAuthenticatedUserId(): Promise<number> {
    const res = await fetch(`${this.baseUrl}/user`, {
      headers: { Authorization: this.token },
    });

    if (!res.ok) {
      throw new Error(`ClickUp API error (GET /user): ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { user: { id: number } };
    return data.user.id;
  }

  private async fetchTeams(): Promise<{ id: string; name: string }[]> {
    const res = await fetch(`${this.baseUrl}/team`, {
      headers: { Authorization: this.token },
    });

    if (!res.ok) {
      throw new Error(`ClickUp API error (GET /team): ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as TeamsResponse;
    return data.teams;
  }

  private async fetchTeamTasks(teamId: string, assigneeId: number): Promise<ClickUpTask[]> {
    const tasks: ClickUpTask[] = [];
    let page = 0;

    while (true) {
      const res = await fetch(
        `${this.baseUrl}/team/${teamId}/task?page=${page}&limit=100&include_closed=false&assignees[]=${assigneeId}`,
        { headers: { Authorization: this.token } },
      );

      if (!res.ok) {
        throw new Error(`ClickUp API error (GET /team/${teamId}/task): ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as TasksResponse;

      if (data.tasks.length === 0) break;

      tasks.push(...data.tasks.map(this.toDomain));
      page++;
    }

    return tasks;
  }

  private toDomain(raw: ClickUpRawTask): ClickUpTask {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description || null,
      status: raw.status.status,
      dueDate: raw.due_date ? new Date(Number(raw.due_date)) : null,
      startDate: raw.start_date ? new Date(Number(raw.start_date)) : null,
      url: raw.url,
      listName: raw.list.name,
      spaceName: raw.space.id,
      priority: raw.priority?.priority ?? null,
      assignees: raw.assignees.map((a) => a.username),
    };
  }

  // ─── Write operations (Phase 5 of the AI plan) ───

  async createTask(listId: string, input: { name: string; description?: string; assigneeIds?: number[]; priority?: number; dueDate?: Date }): Promise<{ id: string; url: string }> {
    const res = await fetch(`${this.baseUrl}/list/${listId}/task`, {
      method: "POST",
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        assignees: input.assigneeIds,
        priority: input.priority,
        due_date: input.dueDate ? input.dueDate.getTime() : undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp API error (POST /list/${listId}/task): ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id: string; url: string };
    return { id: data.id, url: data.url };
  }

  async assignTask(taskId: string, assigneeIds: number[], unassignIds: number[] = []): Promise<void> {
    const res = await fetch(`${this.baseUrl}/task/${taskId}`, {
      method: "PUT",
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        assignees: { add: assigneeIds, rem: unassignIds },
      }),
    });
    if (!res.ok) {
      throw new Error(`ClickUp API error (PUT /task/${taskId} assignees): ${res.status}`);
    }
  }

  async changeTaskStatus(taskId: string, status: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/task/${taskId}`, {
      method: "PUT",
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`ClickUp API error (PUT /task/${taskId} status): ${res.status}`);
    }
  }

  async addTaskComment(taskId: string, body: string, notifyAll: boolean = false): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/task/${taskId}/comment`, {
      method: "POST",
      headers: { Authorization: this.token, "Content-Type": "application/json" },
      body: JSON.stringify({
        comment_text: body,
        notify_all: notifyAll,
      }),
    });
    if (!res.ok) {
      throw new Error(`ClickUp API error (POST task comment): ${res.status}`);
    }
    const data = (await res.json()) as { id: string };
    return { id: data.id };
  }
}
