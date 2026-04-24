import { createCrudStore } from "./createCrudStore";

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

const crud = createCrudStore<Project, CreateProjectInput, UpdateProjectInput>({
  endpoint: "/projects",
  label: "projects",
});

export function useProjectStore() {
  return {
    projects: crud.items,
    fetchProjects: crud.fetchAll,
    createProject: crud.create,
    updateProject: crud.update,
    deleteProject: crud.delete,
  };
}
