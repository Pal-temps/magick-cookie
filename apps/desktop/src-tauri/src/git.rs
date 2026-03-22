use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "M" modified, "A" added, "D" deleted, "?" untracked, "R" renamed
    pub staged: bool,
}

#[derive(Debug, Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

fn run_git(project_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        // Some git commands write to stderr but succeed (e.g., warnings)
        if stderr.contains("fatal:") || stderr.contains("error:") {
            return Err(stderr);
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn is_git_repo(project_path: &str) -> bool {
    Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(project_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn git_is_repo(project_path: String) -> bool {
    is_git_repo(&project_path)
}

#[tauri::command]
pub fn git_status(project_path: String) -> Result<Vec<GitFileStatus>, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let output = run_git(&project_path, &["status", "--porcelain=v1", "-uall"])?;
    let mut files = Vec::new();

    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }

        let index_status = line.chars().nth(0).unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let path = line[3..].to_string();

        // Staged changes (index)
        if index_status != ' ' && index_status != '?' {
            files.push(GitFileStatus {
                path: path.clone(),
                status: index_status.to_string(),
                staged: true,
            });
        }

        // Unstaged changes (worktree)
        if worktree_status != ' ' {
            let status = if worktree_status == '?' {
                "?".to_string()
            } else {
                worktree_status.to_string()
            };
            files.push(GitFileStatus {
                path: path.clone(),
                status,
                staged: false,
            });
        }
    }

    Ok(files)
}

#[tauri::command]
pub fn git_diff(project_path: String, file_path: Option<String>, staged: Option<bool>) -> Result<String, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let mut args = vec!["diff"];
    if staged.unwrap_or(false) {
        args.push("--cached");
    }
    if let Some(ref fp) = file_path {
        args.push("--");
        args.push(fp);
    }

    run_git(&project_path, &args)
}

#[tauri::command]
pub fn git_stage(project_path: String, files: Vec<String>) -> Result<(), String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let mut args: Vec<&str> = vec!["add"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git(&project_path, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(project_path: String, files: Vec<String>) -> Result<(), String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let mut args: Vec<&str> = vec!["restore", "--staged"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git(&project_path, &args)?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(project_path: String, message: String) -> Result<String, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    run_git(&project_path, &["commit", "-m", &message])
}

#[tauri::command]
pub fn git_log(project_path: String, file_path: Option<String>, limit: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let limit_str = format!("-{}", limit.unwrap_or(50));
    let mut args = vec!["log", &limit_str, "--format=%H||%s||%an||%ai"];

    let fp_owned;
    if let Some(ref fp) = file_path {
        args.push("--");
        fp_owned = fp.clone();
        args.push(&fp_owned);
    }

    let output = run_git(&project_path, &args)?;
    let mut entries = Vec::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(4, "||").collect();
        if parts.len() == 4 {
            entries.push(GitLogEntry {
                hash: parts[0][..8.min(parts[0].len())].to_string(),
                message: parts[1].to_string(),
                author: parts[2].to_string(),
                date: parts[3].to_string(),
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
pub fn git_discard(project_path: String, files: Vec<String>) -> Result<(), String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let mut args: Vec<&str> = vec!["checkout", "--"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    run_git(&project_path, &args)?;
    Ok(())
}

// ─── Phase 8: branches, push, pull ───

#[derive(Debug, Serialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[tauri::command]
pub fn git_branches(project_path: String) -> Result<Vec<GitBranch>, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }

    let output = run_git(&project_path, &["branch", "-a", "--no-color"])?;
    let mut branches = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.contains("->") { continue; }

        let is_current = trimmed.starts_with('*');
        let name = trimmed.trim_start_matches("* ").trim_start_matches("remotes/").to_string();
        let is_remote = line.contains("remotes/");

        branches.push(GitBranch { name, is_current, is_remote });
    }

    Ok(branches)
}

#[tauri::command]
pub fn git_checkout(project_path: String, branch: String) -> Result<String, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }
    run_git(&project_path, &["checkout", &branch])
}

#[tauri::command]
pub fn git_pull(project_path: String) -> Result<String, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }
    run_git(&project_path, &["pull", "--rebase"])
}

#[tauri::command]
pub fn git_push(project_path: String) -> Result<String, String> {
    if !is_git_repo(&project_path) {
        return Err("Not a git repository".into());
    }
    run_git(&project_path, &["push"])
}
