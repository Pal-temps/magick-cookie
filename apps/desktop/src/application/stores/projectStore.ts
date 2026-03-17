import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  color?: string;
}

const [projects, setProjects] = createSignal<Project[]>([]);

export function useProjectStore() {
  async function fetchProjects() {
    try {
      const data = await api.get<Project[]>("/projects");
      setProjects(data);
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    }
  }

  async function createProject(input: CreateProjectInput) {
    try {
      const project = await api.post<Project>("/projects", input);
      setProjects((prev) => [...prev, project]);
      return project;
    } catch (e) {
      console.error("Failed to create project:", e);
    }
  }

  async function updateProject(id: string, input: UpdateProjectInput) {
    try {
      const project = await api.put<Project>(`/projects/${id}`, input);
      setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
      return project;
    } catch (e) {
      console.error("Failed to update project:", e);
    }
  }

  async function deleteProject(id: string) {
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error("Failed to delete project:", e);
    }
  }

  return {
    projects,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
