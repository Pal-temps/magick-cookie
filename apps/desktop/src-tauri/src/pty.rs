use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

// ─── Types ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyDataPayload {
    pub id: String,
    pub data: String,
}

// ─── Shared state ───

struct PtyInstance {
    writer: Box<dyn Write + Send>,
    pair: portable_pty::PtyPair,
}

pub struct PtyStore {
    instances: Mutex<HashMap<String, PtyInstance>>,
}

impl PtyStore {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }
}

pub fn new_pty_store() -> Arc<PtyStore> {
    Arc::new(PtyStore::new())
}

// ─── Commands ───

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: tauri::State<'_, Arc<PtyStore>>,
    id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    // Determine shell
    let shell = if cfg!(windows) {
        "powershell.exe"
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()).leak() as &str
    };

    let mut cmd = CommandBuilder::new(shell);
    if cfg!(windows) {
        cmd.args(["-NoLogo", "-NoProfile"]);
    }
    cmd.cwd(&cwd);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    // We don't need to track the child process explicitly;
    // it will be cleaned up when the PTY is dropped.
    drop(child);

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    // Store the writer for pty_write
    {
        let mut store = state.instances.lock().map_err(|e| format!("Lock error: {e}"))?;
        store.insert(
            id.clone(),
            PtyInstance { writer, pair },
        );
    }

    // Read PTY output in background thread → emit to frontend
    let pty_id = id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        "pty-data",
                        PtyDataPayload {
                            id: pty_id.clone(),
                            data: text,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(
    state: tauri::State<'_, Arc<PtyStore>>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut store = state.instances.lock().map_err(|e| format!("Lock error: {e}"))?;
    let instance = store.get_mut(&id).ok_or("PTY not found")?;
    instance
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write error: {e}"))?;
    instance
        .writer
        .flush()
        .map_err(|e| format!("Flush error: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: tauri::State<'_, Arc<PtyStore>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let store = state.instances.lock().map_err(|e| format!("Lock error: {e}"))?;
    let instance = store.get(&id).ok_or("PTY not found")?;
    instance
        .pair
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Resize error: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn pty_kill(
    state: tauri::State<'_, Arc<PtyStore>>,
    id: String,
) -> Result<(), String> {
    let mut store = state.instances.lock().map_err(|e| format!("Lock error: {e}"))?;
    store.remove(&id);
    // Dropping the PtyInstance closes the master, which sends SIGHUP to the shell
    Ok(())
}
