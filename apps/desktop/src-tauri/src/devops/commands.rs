use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use super::binary_manager::{AvailableCli, BinaryManager, InstallPhase, InstalledCli};

/// State shape registered with `tauri::Builder::manage()`.
/// `Option` because building a `BinaryManager` needs `app.path().app_local_data_dir()`,
/// which only resolves once Tauri is running — we therefore lazy-init on first command.
/// `Arc` so commands can clone the manager out of the lock and run long-running installs
/// (download + extract) without holding the mutex.
pub type SharedBinaryManager = Mutex<Option<Arc<BinaryManager>>>;

/// Event channel for install progress updates.
/// Frontend listens via `listen<InstallProgress>(INSTALL_PROGRESS_EVENT, ...)`.
pub const INSTALL_PROGRESS_EVENT: &str = "cli://install/progress";

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "phase", rename_all = "snake_case")]
pub enum InstallProgress {
    Started { name: String },
    Downloading { name: String },
    Verifying { name: String },
    Extracting { name: String },
    Done { name: String, path: String },
    Failed { name: String, error: String },
}

impl InstallProgress {
    fn from_phase(name: &str, phase: InstallPhase) -> Self {
        match phase {
            InstallPhase::Downloading => Self::Downloading {
                name: name.to_string(),
            },
            InstallPhase::Verifying => Self::Verifying {
                name: name.to_string(),
            },
            InstallPhase::Extracting => Self::Extracting {
                name: name.to_string(),
            },
        }
    }
}

pub fn new_state() -> SharedBinaryManager {
    Mutex::new(None)
}

pub(crate) fn ensure_manager(
    app: &AppHandle,
    state: &State<'_, SharedBinaryManager>,
) -> Result<Arc<BinaryManager>, String> {
    let mut guard = state.lock().map_err(|e| format!("state lock: {e}"))?;
    if guard.is_none() {
        let dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| format!("app_local_data_dir: {e}"))?;
        let bm = BinaryManager::new(&dir).map_err(|e| e.to_string())?;
        *guard = Some(Arc::new(bm));
    }
    Ok(guard
        .as_ref()
        .expect("BinaryManager just initialized")
        .clone())
}

#[tauri::command]
pub async fn cli_list_available(
    app: AppHandle,
    state: State<'_, SharedBinaryManager>,
) -> Result<Vec<AvailableCli>, String> {
    let bm = ensure_manager(&app, &state)?;
    Ok(bm.list_available())
}

#[tauri::command]
pub async fn cli_list_installed(
    app: AppHandle,
    state: State<'_, SharedBinaryManager>,
) -> Result<Vec<InstalledCli>, String> {
    let bm = ensure_manager(&app, &state)?;
    Ok(bm.list_installed())
}

#[tauri::command]
pub async fn cli_resolve(
    app: AppHandle,
    state: State<'_, SharedBinaryManager>,
    name: String,
) -> Result<Option<PathBuf>, String> {
    let bm = ensure_manager(&app, &state)?;
    Ok(bm.resolve(&name))
}

#[tauri::command]
pub async fn cli_uninstall(
    app: AppHandle,
    state: State<'_, SharedBinaryManager>,
    name: String,
) -> Result<(), String> {
    let bm = ensure_manager(&app, &state)?;
    bm.uninstall(&name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cli_install(
    app: AppHandle,
    state: State<'_, SharedBinaryManager>,
    name: String,
    force: Option<bool>,
) -> Result<PathBuf, String> {
    let bm = ensure_manager(&app, &state)?;
    let force = force.unwrap_or(false);

    let _ = app.emit(
        INSTALL_PROGRESS_EVENT,
        InstallProgress::Started { name: name.clone() },
    );

    // BinaryManager::install_with_progress is blocking (sync reqwest + zip/tar extraction).
    // Run on the blocking pool so we don't stall the async runtime, and forward phase events
    // through the AppHandle (cloned for the closure — AppHandle is cheap to clone).
    let app_for_phase = app.clone();
    let name_for_install = name.clone();
    let name_for_phase = name.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        bm.install_with_progress(&name_for_install, force, move |phase| {
            let _ = app_for_phase.emit(
                INSTALL_PROGRESS_EVENT,
                InstallProgress::from_phase(&name_for_phase, phase),
            );
        })
    })
    .await
    .map_err(|e| format!("install join error: {e}"))?;

    match &result {
        Ok(path) => {
            let _ = app.emit(
                INSTALL_PROGRESS_EVENT,
                InstallProgress::Done {
                    name: name.clone(),
                    path: path.to_string_lossy().into_owned(),
                },
            );
        }
        Err(e) => {
            let _ = app.emit(
                INSTALL_PROGRESS_EVENT,
                InstallProgress::Failed {
                    name: name.clone(),
                    error: e.to_string(),
                },
            );
        }
    }

    result.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_progress_serializes_with_phase_tag() {
        let s = serde_json::to_string(&InstallProgress::Started { name: "gh".into() }).unwrap();
        assert_eq!(s, r#"{"phase":"started","name":"gh"}"#);

        let s = serde_json::to_string(&InstallProgress::Done {
            name: "gh".into(),
            path: "/tmp/gh".into(),
        })
        .unwrap();
        assert_eq!(s, r#"{"phase":"done","name":"gh","path":"/tmp/gh"}"#);

        let s = serde_json::to_string(&InstallProgress::Failed {
            name: "gh".into(),
            error: "boom".into(),
        })
        .unwrap();
        assert_eq!(s, r#"{"phase":"failed","name":"gh","error":"boom"}"#);
    }

    #[test]
    fn install_progress_from_phase_maps_each_variant() {
        match InstallProgress::from_phase("gh", InstallPhase::Downloading) {
            InstallProgress::Downloading { name } => assert_eq!(name, "gh"),
            other => panic!("expected Downloading, got {other:?}"),
        }
        match InstallProgress::from_phase("gh", InstallPhase::Verifying) {
            InstallProgress::Verifying { name } => assert_eq!(name, "gh"),
            other => panic!("expected Verifying, got {other:?}"),
        }
        match InstallProgress::from_phase("gh", InstallPhase::Extracting) {
            InstallProgress::Extracting { name } => assert_eq!(name, "gh"),
            other => panic!("expected Extracting, got {other:?}"),
        }
    }

    #[test]
    fn new_state_starts_empty() {
        let s = new_state();
        assert!(s.lock().unwrap().is_none());
    }

    #[test]
    fn install_progress_event_name_is_stable() {
        // The frontend hard-codes this string. Treat it as a public contract — change here
        // means a coordinated change in apps/desktop/src/application/services/devopsCliService.ts.
        assert_eq!(INSTALL_PROGRESS_EVENT, "cli://install/progress");
    }
}
