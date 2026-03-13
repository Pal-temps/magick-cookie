import type { ClickUpTask } from "../../domain/connector/clickup.entity";

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
}
