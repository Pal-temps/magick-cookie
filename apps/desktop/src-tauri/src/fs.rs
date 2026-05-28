use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

fn walk_dir(base: &Path, rel: &str, entries: &mut Vec<FsEntry>) -> Result<(), String> {
    let full = if rel.is_empty() {
        base.to_path_buf()
    } else {
        base.join(rel)
    };

    let read = std::fs::read_dir(&full).map_err(|e| format!("read_dir error: {e}"))?;

    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip heavy/internal directories only — dotfiles (.env, .gitignore, etc.) are shown
        if name == ".git"
            || name == "node_modules"
            || name == "target"
            || name == "__pycache__"
            || name == ".next"
            || name == ".nuxt"
        {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("metadata error: {e}"))?;
        let rel_path = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.push(FsEntry {
            name: name.clone(),
            path: rel_path.clone(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });

        if metadata.is_dir() {
            walk_dir(base, &rel_path, entries)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn fs_list_dir(base_path: String) -> Result<Vec<FsEntry>, String> {
    let base = PathBuf::from(&base_path);
    if !base.is_dir() {
        return Err(format!("Not a directory: {base_path}"));
    }
    let mut entries = Vec::new();
    walk_dir(&base, "", &mut entries)?;
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Read error: {e}"))
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir error: {e}"))?;
    }
    std::fs::write(&path, content).map_err(|e| format!("Write error: {e}"))
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(&p).map_err(|e| format!("rmdir error: {e}"))
    } else {
        std::fs::remove_file(&p).map_err(|e| format!("rm error: {e}"))
    }
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("mkdir error: {e}"))
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| format!("rename error: {e}"))
}

// ─── Workspace project scanning ───

#[derive(Debug, Serialize)]
pub struct ProjectEntry {
    pub path: String,
    pub name: String,
    pub markers: Vec<String>,
}

const DEFAULT_MARKERS: &[&str] = &[
    ".git",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    ".project",
];

#[tauri::command]
pub fn fs_scan_projects(root_dirs: Vec<String>) -> Result<Vec<ProjectEntry>, String> {
    let mut projects = Vec::new();

    for root in &root_dirs {
        let root_path = PathBuf::from(root);
        if !root_path.is_dir() {
            continue;
        }

        let entries = std::fs::read_dir(&root_path).map_err(|e| format!("scan error: {e}"))?;

        for entry in entries.flatten() {
            if !entry.metadata().map(|m| m.is_dir()).unwrap_or(false) {
                continue;
            }

            let child_path = entry.path();
            let mut markers = Vec::new();

            for marker in DEFAULT_MARKERS {
                if child_path.join(marker).exists() {
                    markers.push(marker.to_string());
                }
            }

            if !markers.is_empty() {
                let name = entry.file_name().to_string_lossy().to_string();
                let path = child_path.to_string_lossy().to_string().replace('\\', "/");
                projects.push(ProjectEntry {
                    path,
                    name,
                    markers,
                });
            }
        }
    }

    projects.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(projects)
}
