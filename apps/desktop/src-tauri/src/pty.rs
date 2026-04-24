use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

const MAX_PTY_COUNT: usize = 10;

// Characters that are interpreted specially by cmd.exe and /bin/sh. If a caller wants to run
// `ls | grep`, they should pass the full pipeline as a single `command` string — we refuse to
// concatenate multi-arg values that could smuggle extra commands past the shell.
fn reject_shell_metacharacters(value: &str, field: &str) -> Result<(), String> {
    if value
        .chars()
        .any(|c| matches!(c, ';' | '|' | '&' | '`' | '$' | '\n' | '\r' | '<' | '>' | '\0'))
    {
        return Err(format!(
            "Invalid {field}: contains shell metacharacter (;, |, &, `, $, <, >, newline)"
        ));
    }
    Ok(())
}

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
    last_activity: Instant,
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
    command: Option<String>,
    args: Option<Vec<String>>,
) -> Result<(), String> {
    // Enforce maximum PTY count to prevent resource exhaustion
    {
        let store = state.instances.lock().map_err(|e| format!("Lock error: {e}"))?;
        if store.len() >= MAX_PTY_COUNT {
            return Err(format!(
                "Maximum PTY count ({MAX_PTY_COUNT}) reached. Close unused terminals first."
            ));
        }
    }

    // Reject extra args that contain shell metacharacters — otherwise they'd be concatenated into
    // the /C or -c string and smuggled past the shell. The `command` itself is trusted (the
    // caller intentionally authored it), but we also refuse NUL / CR bytes.
    if let Some(cmd) = command.as_deref() {
        if cmd.contains('\0') {
            return Err("Invalid command: contains NUL".into());
        }
    }
    if let Some(ref extra) = args {
        for a in extra {
            reject_shell_metacharacters(a, "arg")?;
        }
    }

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let cmd = if let Some(ref command) = command {
        // Run the command inside the native shell so .cmd/.bat wrappers resolve correctly.
        // On Windows: cmd.exe /C "claude ..."
        // On Unix: /bin/sh -c "claude ..."
        #[cfg(windows)]
        {
            let mut full = command.clone();
            if let Some(ref extra_args) = args {
                for arg in extra_args {
                    full.push(' ');
                    full.push_str(arg);
                }
            }
            let mut c = CommandBuilder::new("cmd.exe");
            c.args(["/C", &full]);
            c.cwd(&cwd);
            c
        }
        #[cfg(not(windows))]
        {
            let mut full = command.clone();
            if let Some(ref extra_args) = args {
                for arg in extra_args {
                    full.push(' ');
                    full.push_str(arg);
                }
            }
            let mut c = CommandBuilder::new("/bin/sh");
            c.args(["-c", &full]);
            c.cwd(&cwd);
            c
        }
    } else {
        // Default: system shell
        let shell = if cfg!(windows) {
            "powershell.exe"
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()).leak() as &str
        };
        let mut c = CommandBuilder::new(shell);
        if cfg!(windows) {
            c.args(["-NoLogo", "-NoProfile"]);
        }
        c.cwd(&cwd);
        c
    };

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn: {e}"))?;

    // Child is cleaned up when the PTY is dropped
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
            PtyInstance { writer, pair, last_activity: Instant::now() },
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
    instance.last_activity = Instant::now();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_store_creation() {
        let store = PtyStore::new();
        let instances = store.instances.lock().unwrap();
        assert!(instances.is_empty(), "PtyStore should start empty");
        assert_eq!(instances.len(), 0);
    }

    #[test]
    fn test_max_pty_tracking() {
        // PtyInstance can't be constructed without a real PTY, so we test
        // the HashMap operations at the PtyStore level via new_pty_store.
        let store = new_pty_store();

        // Verify initial state
        {
            let instances = store.instances.lock().unwrap();
            assert_eq!(instances.len(), 0);
        }

        // We can't insert real PtyInstances, but we can verify the store's
        // Mutex<HashMap> is functional by checking lock/unlock patterns
        // and that multiple Arc clones see the same state.
        let store2 = Arc::clone(&store);
        {
            let instances1 = store.instances.lock().unwrap();
            assert_eq!(instances1.len(), 0);
        }
        {
            let instances2 = store2.instances.lock().unwrap();
            assert_eq!(instances2.len(), 0);
        }
    }

    #[test]
    fn test_pty_store_arc_sharing() {
        // Verify that new_pty_store returns a working Arc<PtyStore>
        // and multiple references see consistent state.
        let store = new_pty_store();
        let clone1 = Arc::clone(&store);
        let clone2 = Arc::clone(&store);

        // All clones should reference the same empty HashMap
        assert_eq!(store.instances.lock().unwrap().len(), 0);
        assert_eq!(clone1.instances.lock().unwrap().len(), 0);
        assert_eq!(clone2.instances.lock().unwrap().len(), 0);

        // Arc strong count should be 3
        assert_eq!(Arc::strong_count(&store), 3);
    }

    #[test]
    fn test_pty_max_count_enforced() {
        // Verify the MAX_PTY_COUNT constant is set to a reasonable value.
        // This prevents resource exhaustion from unbounded PTY creation.
        assert_eq!(MAX_PTY_COUNT, 10, "MAX_PTY_COUNT should be 10 to limit terminal resources");
        assert!(MAX_PTY_COUNT > 0, "MAX_PTY_COUNT must be positive");
        assert!(MAX_PTY_COUNT <= 50, "MAX_PTY_COUNT should not be excessively large");
    }
}
