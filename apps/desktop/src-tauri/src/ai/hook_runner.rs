use serde::{Deserialize, Serialize};
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

const HOOK_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookResult {
    pub command: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub success: bool,
    pub timed_out: bool,
}

fn spawn_hook(cwd: &str, command: &str) -> Result<std::process::Child, String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", command])
            .current_dir(cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Spawn error: {e}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .args(["-c", command])
            .current_dir(cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Spawn error: {e}"))
    }
}

fn drain<R: Read + Send + 'static>(mut stream: R) -> mpsc::Receiver<Vec<u8>> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stream.read_to_end(&mut buf);
        let _ = tx.send(buf);
    });
    rx
}

#[tauri::command]
pub fn ai_run_hook(cwd: String, command: String) -> Result<HookResult, String> {
    let start = Instant::now();
    let mut child = spawn_hook(&cwd, &command)?;

    // Drain stdout/stderr on separate threads so we never deadlock on a pipe that fills before
    // the child exits.
    let stdout_rx = child
        .stdout
        .take()
        .map(drain)
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr_rx = child
        .stderr
        .take()
        .map(drain)
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    // Poll wait with a hard deadline. Hooks that run longer than HOOK_TIMEOUT_SECS get killed so
    // a misbehaving hook cannot freeze the agent.
    let deadline = Instant::now() + Duration::from_secs(HOOK_TIMEOUT_SECS);
    let mut timed_out = false;
    let exit_code = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.code().unwrap_or(-1),
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    timed_out = true;
                    break -1;
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("Wait error: {e}")),
        }
    };

    let stdout = stdout_rx
        .recv_timeout(Duration::from_secs(2))
        .unwrap_or_default();
    let stderr = stderr_rx
        .recv_timeout(Duration::from_secs(2))
        .unwrap_or_default();
    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(HookResult {
        command,
        exit_code,
        stdout: String::from_utf8_lossy(&stdout).to_string(),
        stderr: String::from_utf8_lossy(&stderr).to_string(),
        duration_ms,
        success: !timed_out && exit_code == 0,
        timed_out,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_success() {
        let cwd = std::env::temp_dir().to_str().unwrap().to_string();
        let result = ai_run_hook(cwd, "echo hello".into()).unwrap();
        assert!(result.success);
        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("hello"));
        assert!(!result.timed_out);
        assert!(result.duration_ms < 10000);
    }

    #[test]
    fn test_hook_failure() {
        let cwd = std::env::temp_dir().to_str().unwrap().to_string();

        #[cfg(target_os = "windows")]
        let cmd = "cmd /C exit 1";
        #[cfg(not(target_os = "windows"))]
        let cmd = "exit 1";

        let result = ai_run_hook(cwd, cmd.into()).unwrap();
        assert!(!result.success);
        assert_eq!(result.exit_code, 1);
        assert!(!result.timed_out);
    }
}
