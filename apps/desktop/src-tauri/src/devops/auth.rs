use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use super::commands::{ensure_manager, SharedBinaryManager};
use crate::secrets::SharedSecrets;

pub const AUTH_CODE_EVENT: &str = "cli://auth/code";
pub const AUTH_DONE_EVENT: &str = "cli://auth/done";

#[derive(Debug, Clone, Serialize)]
pub struct AuthCodePayload {
    pub name: String,
    pub user_code: String,
    pub verification_uri: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthDonePayload {
    pub name: String,
    pub success: bool,
    pub username: String,
    pub token: String,
    pub error: String,
}

/// Parse a GitHub device code ("XXXX-YYYY") from a line of gh output.
/// gh prints: "! First copy your one-time code: ABCD-1234"
fn extract_device_code(line: &str) -> Option<String> {
    let pos = line.find("one-time code:")?;
    let rest = line[pos + "one-time code:".len()..].trim();
    let code = rest.split_whitespace().next()?;
    // Validate: must contain exactly one dash, total length 7–12 (e.g. "ABCD-1234")
    if code.contains('-') && code.len() >= 7 && code.len() <= 12 {
        Some(code.to_string())
    } else {
        None
    }
}

/// Blocking: spawn `gh auth login --web`, wait for the device code, then wait for
/// the user to complete the browser flow.  Returns `(username, token)` on success.
fn run_auth_login(app: &AppHandle, name: &str, binary: &Path) -> Result<(String, String), String> {
    let mut child = Command::new(binary)
        .args([
            "auth",
            "login",
            "--hostname",
            "github.com",
            "--web",
            "--git-protocol",
            "https",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {name}: {e}"))?;

    // Feed newlines to stdin every 500 ms to auto-answer any "Press Enter" prompts.
    if let Some(mut stdin) = child.stdin.take() {
        thread::spawn(move || loop {
            if writeln!(stdin).is_err() {
                break;
            }
            thread::sleep(Duration::from_millis(500));
        });
    }

    let (tx, rx) = mpsc::channel::<String>();

    // gh may write the device code to stdout or stderr depending on TTY detection.
    // Drain both and emit the first match.
    let stdout = child.stdout.take().expect("stdout piped");
    {
        let app_c = app.clone();
        let name_c = name.to_string();
        let tx_c = tx.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().flatten() {
                if let Some(code) = extract_device_code(&line) {
                    let _ = app_c.emit(
                        AUTH_CODE_EVENT,
                        AuthCodePayload {
                            name: name_c.clone(),
                            user_code: code.clone(),
                            verification_uri: "https://github.com/login/device".to_string(),
                        },
                    );
                    let _ = tx_c.send(code);
                }
            }
        });
    }

    let stderr = child.stderr.take().expect("stderr piped");
    {
        let app_e = app.clone();
        let name_e = name.to_string();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().flatten() {
                if let Some(code) = extract_device_code(&line) {
                    let _ = app_e.emit(
                        AUTH_CODE_EVENT,
                        AuthCodePayload {
                            name: name_e.clone(),
                            user_code: code.clone(),
                            verification_uri: "https://github.com/login/device".to_string(),
                        },
                    );
                    let _ = tx.send(code);
                }
            }
        });
    }

    // Wait up to 60 s for the device code to appear in gh's output.
    rx.recv_timeout(Duration::from_secs(60))
        .map_err(|_| "Timed out waiting for device code from gh".to_string())?;

    // Wait for gh to complete.  Device codes expire in ~15 min; gh polls until then.
    let status = child.wait().map_err(|e| format!("wait: {e}"))?;
    if !status.success() {
        return Err("Authentication failed or was cancelled".to_string());
    }

    // Extract the OAuth token that gh stored in its config.
    let token_out = Command::new(binary)
        .args(["auth", "token", "--hostname", "github.com"])
        .output()
        .map_err(|e| format!("gh auth token: {e}"))?;
    let token = String::from_utf8_lossy(&token_out.stdout).trim().to_string();
    if token.is_empty() {
        return Err("gh auth token returned empty token".to_string());
    }

    // Get the authenticated username.
    let user_out = Command::new(binary)
        .args(["api", "user", "--jq", ".login"])
        .output()
        .map_err(|e| format!("gh api user: {e}"))?;
    let username = String::from_utf8_lossy(&user_out.stdout).trim().to_string();

    Ok((username, token))
}

/// Start GitHub OAuth device flow via the installed `gh` binary.
/// Emits `cli://auth/code` when the device code is ready, then `cli://auth/done`
/// on completion.  Returns the result payload (including the token) so the frontend
/// can sync it to the API's connector_configs table.
/// The KDBX vault must be unlocked; returns an error early if it is not.
#[tauri::command]
pub async fn cli_auth_login(
    app: AppHandle,
    cli_state: State<'_, SharedBinaryManager>,
    secrets: State<'_, SharedSecrets>,
    name: String,
) -> Result<AuthDonePayload, String> {
    // Fail fast if the vault is locked so the user isn't surprised after the OAuth dance.
    {
        let s = secrets.lock().map_err(|e| e.to_string())?;
        if s.db.is_none() {
            return Err(
                "Le vault doit être déverrouillé avant de lancer l'authentification".to_string(),
            );
        }
    }

    let bm = ensure_manager(&app, &cli_state)?;
    let binary =
        bm.resolve(&name).ok_or_else(|| format!("{name} n'est pas installé — installe-le d'abord"))?;

    let app_c = app.clone();
    let name_c = name.clone();
    let result =
        tauri::async_runtime::spawn_blocking(move || run_auth_login(&app_c, &name_c, &binary))
            .await
            .map_err(|e| format!("join: {e}"))?;

    let payload = match result {
        Ok((username, token)) => {
            // Persist token in KDBX under "App Secrets / {name}_oauth_token".
            crate::secrets::secrets_set_app_secret(
                secrets,
                format!("{name}_oauth_token"),
                token.clone(),
            )
            .map_err(|e| format!("KDBX write: {e}"))?;
            AuthDonePayload {
                name: name.clone(),
                success: true,
                username,
                token,
                error: String::new(),
            }
        }
        Err(e) => AuthDonePayload {
            name: name.clone(),
            success: false,
            username: String::new(),
            token: String::new(),
            error: e,
        },
    };

    let _ = app.emit(AUTH_DONE_EVENT, &payload);
    Ok(payload)
}

/// Returns true if the `gh` binary reports a valid authenticated session.
#[tauri::command]
pub async fn cli_auth_status(
    app: AppHandle,
    state: State<'_, SharedBinaryManager>,
    name: String,
) -> Result<bool, String> {
    let bm = ensure_manager(&app, &state)?;
    let Some(binary) = bm.resolve(&name) else {
        return Ok(false);
    };
    tauri::async_runtime::spawn_blocking(move || {
        Command::new(&binary)
            .args(["auth", "status", "--hostname", "github.com"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

/// Log out from gh and remove the token from KDBX (best-effort if vault is locked).
#[tauri::command]
pub async fn cli_auth_logout(
    app: AppHandle,
    cli_state: State<'_, SharedBinaryManager>,
    secrets: State<'_, SharedSecrets>,
    name: String,
) -> Result<(), String> {
    let bm = ensure_manager(&app, &cli_state)?;
    if let Some(binary) = bm.resolve(&name) {
        // Ignore errors — if gh is already logged out, that's fine.
        let _ = tauri::async_runtime::spawn_blocking(move || {
            Command::new(&binary)
                .args(["auth", "logout", "--hostname", "github.com", "--yes"])
                .status()
        })
        .await;
    }

    // Best-effort: remove token from KDBX (skip silently if vault is locked).
    let key = format!("{name}_oauth_token");
    if let Ok(mut s) = secrets.lock() {
        if let Some(db) = s.db.as_mut() {
            if let Some(group) = db.root.groups.iter_mut().find(|g| g.name == "App Secrets") {
                group.entries.retain(|e| e.get("Title") != Some(&key));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_device_code_finds_standard_github_line() {
        let line = "! First copy your one-time code: ABCD-1234";
        assert_eq!(extract_device_code(line), Some("ABCD-1234".to_string()));
    }

    #[test]
    fn extract_device_code_finds_code_with_ansi_prefix() {
        // gh may prefix lines with ANSI escape codes in some terminals.
        let line = "\x1b[33m! \x1b[0mFirst copy your one-time code: XXXX-YYYY";
        assert_eq!(extract_device_code(line), Some("XXXX-YYYY".to_string()));
    }

    #[test]
    fn extract_device_code_rejects_unrelated_lines() {
        assert_eq!(extract_device_code("nothing here"), None);
        assert_eq!(extract_device_code("Press Enter to open"), None);
        assert_eq!(extract_device_code("Authentication complete"), None);
    }

    #[test]
    fn extract_device_code_rejects_oversized_token() {
        // More than 12 chars after "one-time code:" should be ignored.
        let line = "one-time code: TOOLONGTOKEN12";
        assert_eq!(extract_device_code(line), None);
    }

    #[test]
    fn auth_code_payload_serializes_with_expected_fields() {
        let p = AuthCodePayload {
            name: "gh".into(),
            user_code: "ABCD-1234".into(),
            verification_uri: "https://github.com/login/device".into(),
        };
        let s = serde_json::to_string(&p).unwrap();
        assert!(s.contains(r#""name":"gh""#));
        assert!(s.contains(r#""user_code":"ABCD-1234""#));
        assert!(s.contains(r#""verification_uri""#));
    }

    #[test]
    fn auth_done_payload_serializes_correctly() {
        let p = AuthDonePayload {
            name: "gh".into(),
            success: true,
            username: "octocat".into(),
            token: "gho_xxx".into(),
            error: String::new(),
        };
        let s = serde_json::to_string(&p).unwrap();
        assert!(s.contains(r#""success":true"#));
        assert!(s.contains(r#""username":"octocat""#));
    }

    #[test]
    fn event_name_constants_are_stable() {
        // Frontend hard-codes these strings — treat them as a public contract.
        assert_eq!(AUTH_CODE_EVENT, "cli://auth/code");
        assert_eq!(AUTH_DONE_EVENT, "cli://auth/done");
    }
}
