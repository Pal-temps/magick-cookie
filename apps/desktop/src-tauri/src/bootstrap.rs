/// Bootstrap config — written by the NSIS installer before the first launch.
/// On Windows: %APPDATA%\com.bumblelab.magick-cookie\bootstrap.json
/// The file is consumed (read + deleted) once on startup; subsequent launches see None.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ─── Config struct (mirrors installer/folders.nsi JSON output) ────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapConfig {
    /// Root directory for Choc Notes (.md files + KDBX vault)
    pub notes_dir: String,
    /// Root directory for workspace projects
    pub workspace_dir: String,
}

// ─── Managed state ────────────────────────────────────────────────────────────

pub struct BootstrapState(pub Mutex<Option<BootstrapConfig>>);

// ─── Read + consume bootstrap.json ───────────────────────────────────────────

fn bootstrap_path() -> Option<std::path::PathBuf> {
    // Works on Windows (installer target). Gracefully returns None on other OSes.
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").ok()?;
        Some(
            std::path::PathBuf::from(appdata)
                .join("com.bumblelab.magick-cookie")
                .join("bootstrap.json"),
        )
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

/// Read bootstrap.json if present, delete it, return the config.
/// Called once at startup before the Tauri app is built.
pub fn consume() -> Option<BootstrapConfig> {
    let path = bootstrap_path()?;
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    let config: BootstrapConfig = serde_json::from_str(&content).ok()?;
    let _ = std::fs::remove_file(&path); // consumed — never shown again
    Some(config)
}

// ─── Tauri command ────────────────────────────────────────────────────────────

/// Called by the frontend on mount. Returns the bootstrap config once, then None.
#[tauri::command]
pub fn get_bootstrap_config(
    state: tauri::State<'_, BootstrapState>,
) -> Option<BootstrapConfig> {
    state.0.lock().unwrap().take()
}
