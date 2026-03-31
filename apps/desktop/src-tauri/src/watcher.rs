use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct FsChangeEvent {
    pub path: String,
    pub kind: String, // "modify" | "remove"
}

pub type SharedWatcher = Arc<Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>>>;

pub fn new_shared_watcher() -> SharedWatcher {
    Arc::new(Mutex::new(None))
}

#[tauri::command]
pub fn fs_watch_start(
    app: AppHandle,
    watcher: tauri::State<'_, SharedWatcher>,
    path: String,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);
    if !watch_path.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    // Stop existing watcher if any
    {
        let mut guard = watcher.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }

    let app_handle = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |events: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            let events = match events {
                Ok(evts) => evts,
                Err(_) => return,
            };

            for event in events {
                let event_path = event.path.to_string_lossy().to_string().replace('\\', "/");

                // Skip heavy/internal directories
                if event_path.contains("/.git/")
                    || event_path.contains("/node_modules/")
                    || event_path.contains("/target/")
                    || event_path.contains("/__pycache__/")
                {
                    continue;
                }

                let kind = match event.kind {
                    DebouncedEventKind::Any => {
                        if event.path.exists() { "modify" } else { "remove" }
                    }
                    DebouncedEventKind::AnyContinuous => "modify",
                    _ => "modify",
                };

                let _ = app_handle.emit(
                    "fs-change",
                    FsChangeEvent {
                        path: event_path,
                        kind: kind.to_string(),
                    },
                );
            }
        },
    )
    .map_err(|e| format!("Watcher init error: {e}"))?;

    debouncer
        .watcher()
        .watch(&watch_path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("Watch error: {e}"))?;

    let mut guard = watcher.lock().map_err(|e| e.to_string())?;
    *guard = Some(debouncer);

    Ok(())
}

#[tauri::command]
pub fn fs_watch_stop(watcher: tauri::State<'_, SharedWatcher>) -> Result<(), String> {
    let mut guard = watcher.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
