use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::secrets::SharedSecrets;

const CONFIG_FILE: &str = "notes-config.json";

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

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("no app data dir")
}

fn config_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join(CONFIG_FILE)
}

/// Public accessor for other modules (secrets.rs)
pub fn load_config_pub(app: &AppHandle) -> Result<NotesConfig, String> {
    load_config(app)
}

fn load_config(app: &AppHandle) -> Result<NotesConfig, String> {
    let path = config_path(app);
    if !path.exists() {
        return Err("Notes not configured".into());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| format!("Read config error: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("Parse config error: {e}"))
}

// ─── SSH via KDBX vault ───

/// Read a private SSH key from the KDBX vault by name
fn get_ssh_key_from_vault(secrets: &crate::secrets::SecretsState, key_name: &str) -> Result<String, String> {
    let db = secrets.db.as_ref().ok_or("Vault not unlocked — cannot access SSH keys")?;
    if let Some(group) = db.root.group_by_path(&["App Secrets", "SSH Keys"]) {
        for entry in &group.entries {
            if entry.get("Title") == Some(key_name) {
                return Ok(entry.get("Password").unwrap_or("").to_string());
            }
        }
    }
    Err(format!("SSH key '{}' not found in vault. Generate one in Coffre > Cles SSH.", key_name))
}

/// Export SSH key from vault to a temp file and return GIT_SSH_COMMAND + temp dir to clean up
fn vault_ssh_command(secrets: &crate::secrets::SecretsState, key_name: &str) -> Result<(String, PathBuf), String> {
    let private_key = get_ssh_key_from_vault(secrets, key_name)?;

    let tmp_dir = std::env::temp_dir().join(format!("mc-git-ssh-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("tmp mkdir error: {e}"))?;

    let key_file = tmp_dir.join("key");
    std::fs::write(&key_file, &private_key).map_err(|e| format!("Write temp key error: {e}"))?;

    // Set permissions to 600 on Unix (required by SSH)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&key_file, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("chmod error: {e}"))?;
    }

    let key_str = key_file.to_string_lossy().replace('\\', "/");
    let cmd = format!("ssh -i \"{key_str}\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new");

    Ok((cmd, tmp_dir))
}

/// Apply vault SSH env to a git Command. Returns the temp dir to clean up after.
fn apply_vault_ssh_env(
    cmd: &mut Command,
    secrets: &crate::secrets::SecretsState,
    key_name: &str,
) -> Result<PathBuf, String> {
    let (ssh_cmd, tmp_dir) = vault_ssh_command(secrets, key_name)?;
    cmd.env("GIT_SSH_COMMAND", ssh_cmd);
    Ok(tmp_dir)
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
pub async fn notes_set_config(
    app: AppHandle,
    secrets: tauri::State<'_, SharedSecrets>,
    path: String,
    remote: String,
    ssh_key_name: Option<String>,
) -> Result<(), String> {
    let notes_dir = PathBuf::from(&path);

    // If directory doesn't exist and remote is provided, clone it
    if !notes_dir.exists() && !remote.is_empty() {
        if !remote.starts_with("https://") && !remote.starts_with("git@") && !remote.starts_with("ssh://") {
            return Err(format!("Remote URL must use https:// or SSH (git@): {remote}"));
        }
        let mut cmd = Command::new("git");
        cmd.arg("clone").arg("--config").arg("core.hooksPath=/dev/null").arg(&remote).arg(&path);

        let mut tmp_dir = None;
        if let Some(ref key_name) = ssh_key_name {
            let s = secrets.lock().map_err(|e| e.to_string())?;
            tmp_dir = Some(apply_vault_ssh_env(&mut cmd, &s, key_name)?);
        }

        let output = cmd.output().map_err(|e| format!("Git clone failed: {e}"))?;

        if let Some(td) = tmp_dir { let _ = std::fs::remove_dir_all(td); }

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Git clone error: {stderr}"));
        }
    } else if !notes_dir.exists() {
        std::fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Cannot create dir: {e}"))?;
        Command::new("git")
            .arg("init")
            .current_dir(&notes_dir)
            .output()
            .map_err(|e| format!("Git init failed: {e}"))?;
    }

    // If remote is set and repo exists, ensure origin is configured
    if !remote.is_empty() && notes_dir.exists() {
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

        // Skip hidden files/dirs (.git, .obsidian) and internal vault dirs
        // Allow user-facing underscore dirs
        const ALLOWED_UNDERSCORE: &[&str] = &[
            "_bookmarks", "_workflows", "_ide", "_projects", "_snippets",
            "_config", "_secrets", "_mcp", "_sessions",
            "_journal", "_benchmarks", "_snapshots",
        ];
        if name.starts_with('.') || (name.starts_with('_') && !ALLOWED_UNDERSCORE.contains(&name.as_str())) {
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

// ─── Git Operations (use SSH keys from KDBX vault) ───

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
pub async fn notes_git_pull(
    app: AppHandle,
    secrets: tauri::State<'_, SharedSecrets>,
    ssh_key_name: Option<String>,
) -> Result<String, String> {
    let config = load_config(&app)?;

    let mut cmd = Command::new("git");
    cmd.args(["pull", "--rebase"]).current_dir(&config.path);

    let mut tmp_dir = None;
    if let Some(ref key_name) = ssh_key_name {
        let s = secrets.lock().map_err(|e| e.to_string())?;
        tmp_dir = Some(apply_vault_ssh_env(&mut cmd, &s, key_name)?);
    }

    let output = cmd.output().map_err(|e| format!("Git pull failed: {e}"))?;

    if let Some(td) = tmp_dir { let _ = std::fs::remove_dir_all(td); }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git pull error: {stderr}"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn notes_git_push(
    app: AppHandle,
    secrets: tauri::State<'_, SharedSecrets>,
    message: String,
    ssh_key_name: Option<String>,
) -> Result<String, String> {
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

    let commit_out = String::from_utf8_lossy(&output.stdout).to_string();

    // git push (with vault SSH key)
    let mut cmd = Command::new("git");
    cmd.args(["push"]).current_dir(dir);

    let mut tmp_dir = None;
    if let Some(ref key_name) = ssh_key_name {
        let s = secrets.lock().map_err(|e| e.to_string())?;
        tmp_dir = Some(apply_vault_ssh_env(&mut cmd, &s, key_name)?);
    }

    let output = cmd.output().map_err(|e| format!("Git push failed: {e}"))?;

    if let Some(td) = tmp_dir { let _ = std::fs::remove_dir_all(td); }

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

// ═══════════════════════════════════════════
// VAULT COMMANDS (centralized file storage)
// ═══════════════════════════════════════════

const VAULT_DIRS: &[&str] = &[
    "_bookmarks",
    "_benchmarks",
    "_journal",
    "_config",
    "_ide/skills",
    "_ide/hooks",
    "_ide/prompts",
    "_projects",
    "_snapshots",
    "_secrets",
    "_mcp",
    "_sessions",
    "_snippets",
    "_workflows",
];

const VAULT_GITIGNORE: &str = "# Magick Cookie vault\n*.secrets.*\n*.secret.*\n_snapshots/\n";

/// Ensure all vault subdirectories and .gitignore exist
#[tauri::command]
pub async fn vault_ensure_structure(app: AppHandle) -> Result<(), String> {
    let config = load_config(&app)?;
    let vault = PathBuf::from(&config.path);

    if !vault.exists() {
        return Err("Vault path does not exist".into());
    }

    for dir in VAULT_DIRS {
        let full = vault.join(dir);
        if !full.exists() {
            std::fs::create_dir_all(&full)
                .map_err(|e| format!("Failed to create {dir}: {e}"))?;
        }
    }

    let gitignore = vault.join(".gitignore");
    if !gitignore.exists() {
        std::fs::write(&gitignore, VAULT_GITIGNORE)
            .map_err(|e| format!("Failed to write .gitignore: {e}"))?;
    }

    // Write README.md in each vault directory (only if absent)
    let readmes: &[(&str, &str)] = &[
        ("_config/README.md", "# Configuration\n\nFichiers de configuration de l'app (exportes automatiquement, sans secrets).\n"),
        ("_ide/skills/README.md", "# Skills IA\n\nSkills reutilisables au format markdown avec frontmatter YAML.\n\nExemple:\n```yaml\n---\nname: deploy-app\ndescription: Deploie une application\ntrigger: manual\ntools_required: [ssh_exec, dns_create_record]\n---\n\n## Instructions\n1. Creer le sous-domaine\n2. Deployer via git push\n```\n"),
        ("_ide/hooks/README.md", "# Hooks\n\nHooks executes avant/apres certaines actions (deploy, commit, etc.).\n"),
        ("_ide/prompts/README.md", "# Prompts\n\nPrompts templates inserables avec @title dans le composer IA.\n"),
        ("_projects/README.md", "# Projets\n\nChaque sous-dossier correspond a un projet IDE.\nLe fichier CLAUDE.md dans chaque projet configure le comportement de l'IA.\n"),
        ("_snapshots/README.md", "# Snapshots\n\nBackups automatiques de la base de donnees.\nCe dossier est gitignore par defaut.\n"),
        ("_secrets/README.md", "# Coffre-fort\n\nFichier KDBX chiffre (AES-256). Ne pas modifier manuellement.\nUtilisez l'interface Coffre dans l'app pour gerer vos secrets.\n"),
    ];

    for (path, content) in readmes {
        let full = vault.join(path);
        if !full.exists() {
            if let Some(parent) = full.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            std::fs::write(&full, content).ok();
        }
    }

    Ok(())
}

fn validate_vault_path(vault: &PathBuf, rel_path: &str) -> Result<PathBuf, String> {
    if rel_path.contains("..") {
        return Err("Path traversal not allowed".into());
    }
    let full = vault.join(rel_path);

    // Simple prefix check — no canonicalize needed (we already blocked "..")
    let vault_str = vault.to_string_lossy().replace('\\', "/");
    let full_str = full.to_string_lossy().replace('\\', "/");
    if !full_str.starts_with(&vault_str) {
        return Err("Path escapes vault boundary".into());
    }
    Ok(full)
}

#[tauri::command]
pub async fn vault_read_json(app: AppHandle, rel_path: String) -> Result<String, String> {
    let config = load_config(&app)?;
    let vault = PathBuf::from(&config.path);
    let full = validate_vault_path(&vault, &rel_path)?;

    if !full.exists() {
        return Err(format!("File not found: {rel_path}"));
    }

    std::fs::read_to_string(&full)
        .map_err(|e| format!("Read error: {e}"))
}

#[tauri::command]
pub async fn vault_write_json(app: AppHandle, rel_path: String, content: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let vault = PathBuf::from(&config.path);
    let full = validate_vault_path(&vault, &rel_path)?;

    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir error: {e}"))?;
    }

    std::fs::write(&full, &content)
        .map_err(|e| format!("Write error: {e}"))
}

#[tauri::command]
pub async fn vault_list_section(
    app: AppHandle,
    section: String,
    ext: Option<String>,
) -> Result<Vec<NoteEntry>, String> {
    let config = load_config(&app)?;
    let vault = PathBuf::from(&config.path);
    let section_dir = validate_vault_path(&vault, &section)?;

    if !section_dir.exists() || !section_dir.is_dir() {
        return Ok(vec![]);
    }

    let filter_ext = ext.unwrap_or_default();
    let mut entries = Vec::new();

    fn collect_section(base: &PathBuf, dir: &PathBuf, ext: &str, entries: &mut Vec<NoteEntry>) -> Result<(), String> {
        let read_dir = std::fs::read_dir(dir).map_err(|e| format!("Read dir error: {e}"))?;
        for entry in read_dir.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            if name.starts_with('.') { continue; }

            if path.is_dir() {
                collect_section(base, &path, ext, entries)?;
            } else if ext.is_empty() || name.ends_with(ext) {
                let relative = path.strip_prefix(base).unwrap_or(&path)
                    .to_string_lossy().replace('\\', "/");
                let metadata = std::fs::metadata(&path).ok();
                let modified = metadata.as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs()).unwrap_or(0);
                let size = metadata.map(|m| m.len()).unwrap_or(0);
                entries.push(NoteEntry { name, path: relative, modified, size });
            }
        }
        Ok(())
    }

    collect_section(&section_dir, &section_dir, &filter_ext, &mut entries)?;
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

#[tauri::command]
pub async fn vault_delete_file(app: AppHandle, rel_path: String) -> Result<(), String> {
    let config = load_config(&app)?;
    let vault = PathBuf::from(&config.path);
    let file_path = validate_vault_path(&vault, &rel_path)?;

    if !file_path.exists() {
        return Err(format!("File not found: {rel_path}"));
    }

    std::fs::remove_file(&file_path).map_err(|e| format!("Delete error: {e}"))?;
    Ok(())
}
