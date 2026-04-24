// Thin facade over the git_* Tauri commands. UI components (GitPanel) should import from here
// rather than calling invoke() directly — keeps the DDD boundary clean and makes the surface
// easy to mock in tests.

import { invoke } from "@tauri-apps/api/core";

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export const gitService = {
  isRepo: (projectPath: string) =>
    invoke<boolean>("git_is_repo", { projectPath }),

  status: (projectPath: string) =>
    invoke<GitFileStatus[]>("git_status", { projectPath }),

  branches: (projectPath: string) =>
    invoke<GitBranch[]>("git_branches", { projectPath }),

  log: (projectPath: string, limit = 20) =>
    invoke<GitLogEntry[]>("git_log", { projectPath, limit }),

  stage: (projectPath: string, files: string[]) =>
    invoke<void>("git_stage", { projectPath, files }),

  unstage: (projectPath: string, files: string[]) =>
    invoke<void>("git_unstage", { projectPath, files }),

  discard: (projectPath: string, files: string[]) =>
    invoke<void>("git_discard", { projectPath, files }),

  commit: (projectPath: string, message: string) =>
    invoke<void>("git_commit", { projectPath, message }),

  pull: (projectPath: string) =>
    invoke<void>("git_pull", { projectPath }),

  push: (projectPath: string) =>
    invoke<void>("git_push", { projectPath }),

  checkout: (projectPath: string, branch: string) =>
    invoke<void>("git_checkout", { projectPath, branch }),
};
