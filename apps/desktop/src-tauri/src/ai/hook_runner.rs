use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookResult {
    pub command: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub success: bool,
}

#[tauri::command]
pub fn ai_run_hook(cwd: String, command: String) -> Result<HookResult, String> {
    let start = Instant::now();

    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", &command])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Spawn error: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh")
        .args(["-c", &command])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Spawn error: {e}"))?;

    let duration_ms = start.elapsed().as_millis() as u64;
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(HookResult {
        command,
        exit_code,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        duration_ms,
        success: exit_code == 0,
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
    }
}
