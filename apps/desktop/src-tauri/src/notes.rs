use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const CONFIG_FILE: &str = "notes-config.json";
const SSH_DIR: &str = "notes-ssh";
const SSH_KEY_NAME: &str = "id_ed25519";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotesConfig {
    pub path: String,
    pub remote: String,
}

#[derive(Debug, Serialize)]
pub struct NoteEntry {
    pub name: String,
    pub path: String,
    pub modified: u64,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct GitStatus {
    pub has_changes: bool,
    pub summary: String,
}

#[derive(Debug, Serialize)]
pub struct SshKeyInfo {
    pub exists: bool,
    pub pubkey: Option<String>,
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("no app data dir")
}

fn config_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(CONFIG_FILE)
}

fn ssh_dir(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(SSH_DIR)
}

fn ssh_key_path(app: &AppHandle) -> PathBuf {
    ssh_dir(app).join(SSH_KEY_NAME)
}

fn ssh_pubkey_path(app: &AppHandle) -> PathBuf {
    ssh_dir(app).join(format!("{SSH_KEY_NAME}.pub"))
}

/// Build GIT_SSH_COMMAND that uses our dedicated key
fn git_ssh_command(app: &AppHandle) -> Option<String> {
    let key = ssh_key_path(app);
    if key.exists() {
        let key_str = key.to_string_lossy().replace('\\', "/");
        Some(format!("ssh -i \"{key_str}\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"))
    } else {
        None
    }
}

/// Apply SSH env to a git Command if we have a key
fn apply_ssh_env(cmd: &mut Command, app: &AppHandle) {
    if let Some(ssh_cmd) = git_ssh_command(app) {
        cmd.env("GIT_SSH_COMMAND", ssh_cmd);
    }
}

fn load_config(app: &AppHandle) -> Result<NotesConfig, String> {
    let path = config_path(app);
    if !path.exists() {
        return Err("Notes not configured".into());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| format!("Read config error: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Parse config error: {e}"))
}

// ─── SSH Key Management ───

#[tauri::command]
pub async fn notes_ssh_status(app: AppHandle) -> Result<SshKeyInfo, String> {
    let pubkey_path = ssh_pubkey_path(&app);
    if pubkey_path.exists() {
        Ok(SshKeyInfo {
            exists: true,
            pubkey: None, // Don't return pubkey after first generation
        })
    } else {
        Ok(SshKeyInfo {
            exists: false,
            pubkey: None,
        })
    }
}

#[tauri::command]
pub async fn notes_ssh_generate(app: AppHandle) -> Result<String, String> {
    let dir = ssh_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create ssh dir: {e}"))?;

    let key_path = ssh_key_path(&app);
    let pubkey_path = ssh_pubkey_path(&app);

    // Don't overwrite existing key
    if key_path.exists() {
        return Err("Une cle SSH existe deja. Supprimez-la d'abord si vous voulez en regenerer une.".into());
    }

    // Generate ed25519 key with no passphrase
    let output = Command::new("ssh-keygen")
        .args([
            "-t", "ed25519",
            "-f", &key_path.to_string_lossy(),
            "-N", "",
            "-C", "do-it-now-notes",
        ])
        .output()
        .map_err(|e| format!("ssh-keygen failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ssh-keygen error: {stderr}"));
    }

    // Read and return the public key
    let pubkey = std::fs::read_to_string(&pubkey_path)
        .map_err(|e| format!("Cannot read public key: {e}"))?;

    Ok(pubkey.trim().to_string())
}

// ─── Config ───

#[tauri::command]
pub async fn notes_get_config(app: AppHandle) -> Result<Option<NotesConfig>, String> {
    match load_config(&app) {
        Ok(config) => Ok(Some(config)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn notes_set_config(app: AppHandle, path: String, remote: String) -> Result<(), String> {
    let notes_dir = PathBuf::from(&path);

    // If directory doesn't exist and remote is provided, clone it
    if !notes_dir.exists() && !remote.is_empty() {
        let mut cmd = Command::new("git");
        cmd.arg("clone").arg(&remote).arg(&path);
        apply_ssh_env(&mut cmd, &app);

        let output = cmd.output().map_err(|e| format!("Git clone failed: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Git clone error: {stderr}"));
        }
    } else if !notes_dir.exists() {
        std::fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Cannot create dir: {e}"))?;
        // Init git repo
        Command::new("git")
            .arg("init")
            .current_dir(&notes_dir)
            .output()
            .map_err(|e| format!("Git init failed: {e}"))?;
    }

    // If remote is set and repo exists, ensure origin is configured
    if !remote.is_empty() && notes_dir.exists() {
        // Try to set remote origin (add or update)
        let output = Command::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(&notes_dir)
            .output()
            .ok();

        let has_origin = output.map(|o| o.status.success()).unwrap_or(false);

        if has_origin {
            Command::new("git")
                .args(["remote", "set-url", "origin", &remote])
                .current_dir(&notes_dir)
                .output()
                .ok();
        } else {
            Command::new("git")
                .args(["remote", "add", "origin", &remote])
                .current_dir(&notes_dir)
                .output()
                .ok();
        }
    }

    let config = NotesConfig { path, remote };
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialize error: {e}"))?;
    let cfg_path = config_path(&app);
    std::fs::create_dir_all(cfg_path.parent().unwrap()).ok();
    std::fs::write(&cfg_path, json).map_err(|e| format!("Write config error: {e}"))?;

    Ok(())
}

// ─── Notes CRUD ───

#[tauri::command]
pub async fn notes_list(app: AppHandle) -> Result<Vec<NoteEntry>, String> {
    list_files_by_ext(&app, ".md")
}

#[tauri::command]
pub async fn notes_list_drawings(app: AppHandle) -> Result<Vec<NoteEntry>, String> {
    list_files_by_ext(&app, ".excalidraw")
}

fn list_files_by_ext(app: &AppHandle, ext: &str) -> Result<Vec<NoteEntry>, String> {
    let config = load_config(app)?;
    let notes_dir = PathBuf::from(&config.path);

    if !notes_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    collect_files(&notes_dir, &notes_dir, ext, &mut entries)?;
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

fn collect_files(base: &PathBuf, dir: &PathBuf, ext: &str, entries: &mut Vec<NoteEntry>) -> Result<(), String> {
    let read_dir = std::fs::read_dir(dir).map_err(|e| format!("Read dir error: {e}"))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Skip hidden files/dirs (.git, .obsidian, etc.)
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_files(base, &path, ext, entries)?;
        } else if name.ends_with(ext) {
            let relative = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");

            let metadata = std::fs::metadata(&path).ok();
            let modified = metadata
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let size = metadata.map(|m| m.len()).unwrap_or(0);

            entries.push(NoteEntry {
                name: name.trim_end_matches(ext).to_string(),
                path: relative,
                modified,
                size,
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn notes_list_folders(app: AppHandle) -> Result<Vec<String>, String> {
    let config = load_config(&app)?;
    let notes_dir = PathBuf::from(&config.path);

    if !notes_dir.exists() {
        return Ok(vec![]);
    }

    let mut folders = Vec::new();
    collect_folders(&notes_dir, &notes_dir, &mut folders)?;
    folders.sort();
    Ok(folders)
}

fn collect_folders(base: &PathBuf, dir: &PathBuf, folders: &mut Vec<String>) -> Result<(), String> {
    let read_dir = std::fs::read_dir(dir).map_err(|e| format!("Read dir error: {e}"))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Skip hidden dirs (.git, .obsidian, etc.)
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let relative = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            folders.push(relative);
            collect_folders(base, &path, folders)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn notes_create_folder(app: AppHandle, path: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let folder_path = PathBuf::from(&config.path).join(&path);
    std::fs::create_dir_all(&folder_path).map_err(|e| format!("Mkdir error: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn notes_rename(app: AppHandle, old_path: String, new_path: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let base = PathBuf::from(&config.path);
    let from = base.join(&old_path);
    let to = base.join(&new_path);
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Mkdir error: {e}"))?;
    }
    std::fs::rename(&from, &to).map_err(|e| format!("Rename error: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn notes_read(app: AppHandle, path: String) -> Result<String, String> {
    let config = load_config(&app)?;
    let file_path = PathBuf::from(&config.path).join(&path);
    std::fs::read_to_string(&file_path).map_err(|e| format!("Read error: {e}"))
}

#[tauri::command]
pub async fn notes_save(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let file_path = PathBuf::from(&config.path).join(&path);

    // Create parent dirs if needed
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Mkdir error: {e}"))?;
    }

    std::fs::write(&file_path, content).map_err(|e| format!("Write error: {e}"))
}

#[tauri::command]
pub async fn notes_delete(app: AppHandle, path: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let file_path = PathBuf::from(&config.path).join(&path);
    std::fs::remove_file(&file_path).map_err(|e| format!("Delete error: {e}"))
}

#[tauri::command]
pub async fn notes_delete_folder(app: AppHandle, path: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let dir_path = PathBuf::from(&config.path).join(&path);
    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }
    std::fs::remove_dir_all(&dir_path).map_err(|e| format!("Delete folder error: {e}"))
}

// ─── Git Operations ───

#[tauri::command]
pub async fn notes_git_status(app: AppHandle) -> Result<GitStatus, String> {
    let config = load_config(&app)?;
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&config.path)
        .output()
        .map_err(|e| format!("Git status failed: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let has_changes = !stdout.trim().is_empty();

    let summary = if has_changes {
        let changed = stdout.lines().count();
        format!("{changed} fichier(s) modifie(s)")
    } else {
        "Aucune modification".into()
    };

    Ok(GitStatus { has_changes, summary })
}

#[tauri::command]
pub async fn notes_git_pull(app: AppHandle) -> Result<String, String> {
    let config = load_config(&app)?;

    let mut cmd = Command::new("git");
    cmd.args(["pull", "--rebase"]).current_dir(&config.path);
    apply_ssh_env(&mut cmd, &app);

    let output = cmd.output().map_err(|e| format!("Git pull failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git pull error: {stderr}"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn notes_git_push(app: AppHandle, message: String) -> Result<String, String> {
    let config = load_config(&app)?;
    let dir = &config.path;

    // git add -A
    let output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Git add failed: {e}"))?;
    if !output.status.success() {
        return Err(format!("Git add error: {}", String::from_utf8_lossy(&output.stderr)));
    }

    // git commit
    let msg = if message.is_empty() {
        format!("notes: update {}", chrono_now())
    } else {
        message
    };

    let output = Command::new("git")
        .args(["commit", "-m", &msg])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Git commit failed: {e}"))?;

    // Commit can "fail" if nothing to commit — that's ok
    let commit_out = String::from_utf8_lossy(&output.stdout).to_string();

    // git push
    let mut cmd = Command::new("git");
    cmd.args(["push"]).current_dir(dir);
    apply_ssh_env(&mut cmd, &app);

    let output = cmd.output().map_err(|e| format!("Git push failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git push error: {stderr}"));
    }

    Ok(commit_out)
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}
