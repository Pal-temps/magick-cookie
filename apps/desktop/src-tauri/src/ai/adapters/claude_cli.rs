use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

use crate::ai::adapter::BackendAdapter;
use crate::ai::types::*;

/// Combined Magick MCP server — permissions + all ToolRegistry tools.
/// Embedded at compile time, extracted to a temp file on first use.
const MAGICK_MCP_SCRIPT: &str =
    include_str!("../../../../../api/src/mcp/magick-mcp-server.ts");

/// Default API URL (must match the Bun API server port).
const DEFAULT_API_URL: &str = "http://localhost:47300";

/// Magick Cookie project root, resolved at runtime from the executable's location.
///
/// In development:   <project>/apps/desktop/src-tauri/target/debug/magick-cookie.exe
///                   → 4 levels up → <project>/
/// In production:    <install>/magick-cookie.exe  (flat, no source tree)
///                   → returns the install dir (source protection becomes a no-op,
///                     which is safe — the permission dialog still fires for all writes).
fn magick_app_root() -> std::path::PathBuf {
    // Prefer the compile-time path in dev builds (accurate), fall back to exe dir.
    #[cfg(debug_assertions)]
    {
        // apps/desktop/src-tauri → ../../ → project root
        const CARGO_MANIFEST_DIR: &str = env!("CARGO_MANIFEST_DIR");
        let dev_root = std::path::Path::new(CARGO_MANIFEST_DIR)
            .parent().unwrap_or(std::path::Path::new("."))
            .parent().unwrap_or(std::path::Path::new("."))
            .to_path_buf();
        if dev_root.exists() {
            return dev_root;
        }
    }
    // Runtime fallback: exe location (production, or dev if compile-time path is wrong)
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Write the combined Magick MCP server script to a temp file (idempotent).
fn ensure_magick_mcp_script() -> Result<PathBuf, String> {
    let path = std::env::temp_dir().join("magick-mcp-server.ts");
    // Always overwrite — the script may have changed between builds
    std::fs::write(&path, MAGICK_MCP_SCRIPT)
        .map_err(|e| format!("Failed to write Magick MCP script: {e}"))?;
    Ok(path)
}

/// Write an mcp-config.json pointing at the combined server and return its path.
fn write_mcp_config(script_path: &PathBuf, api_url: &str, session_id: &str) -> Result<PathBuf, String> {
    let app_root = magick_app_root();
    let app_root_str = app_root.to_str().unwrap_or("").replace('\\', "/");

    let config = serde_json::json!({
        "mcpServers": {
            "magick": {
                "command": "bun",
                "args": ["run", script_path.to_str().unwrap_or("")],
                "env": {
                    "MAGICK_API_URL": api_url,
                    "MAGICK_SESSION_ID": session_id,
                    "MAGICK_APP_ROOT": app_root_str
                }
            }
        }
    });

    // Use char-safe truncation to avoid panicking on multi-byte UTF-8 session IDs
    let prefix: String = session_id.chars().take(8).collect();
    let config_path = std::env::temp_dir()
        .join(format!("magick-mcp-config-{}.json", prefix));

    std::fs::write(&config_path, config.to_string())
        .map_err(|e| format!("Failed to write MCP config: {e}"))?;

    Ok(config_path)
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/// Claude Code CLI adapter using `--resume` for multi-turn conversations.
///
/// Each message spawns a new `claude --print --output-format stream-json --resume <id>`
/// process. Claude CLI handles session persistence internally.
///
/// The `--permission-prompt-tool mcp__magick__ask` flag delegates all
/// permission decisions to the combined Magick MCP server, which in turn
/// calls the Magick Cookie API so the user can approve/deny in the UI.
pub struct ClaudeCliAdapter {
    binary: String,
    cwd: String,
    model: String,
    /// Claude CLI session ID (captured from the first `system.init` response)
    cli_session_id: Arc<Mutex<Option<String>>>,
    /// Current running process (one per turn)
    current_process: Option<Child>,
    /// Channel to forward events to the session manager
    event_tx: Option<mpsc::Sender<AdapterEvent>>,
    alive: bool,
    /// Path to the temp mcp-config.json (cleaned up on stop)
    mcp_config_path: Option<PathBuf>,
}

impl ClaudeCliAdapter {
    pub fn new() -> Self {
        Self {
            binary: String::new(),
            cwd: String::new(),
            model: String::new(),
            cli_session_id: Arc::new(Mutex::new(None)),
            current_process: None,
            event_tx: None,
            alive: false,
            mcp_config_path: None,
        }
    }

    /// Find the claude binary in PATH
    fn find_binary() -> Result<String, String> {
        for name in &["claude", "claude.cmd"] {
            if Command::new(name)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
            {
                return Ok((*name).into());
            }
        }
        Err("Claude CLI not found in PATH. Install: https://docs.anthropic.com/en/docs/claude-code".into())
    }

    /// Spawn a claude process for a single turn and stream NDJSON events.
    /// Returns the child process handle.
    fn spawn_turn(
        binary: &str,
        cwd: &str,
        model: &str,
        prompt: &str,
        session_id: Option<&str>,
        mcp_config_path: Option<&PathBuf>,
        event_tx: mpsc::Sender<AdapterEvent>,
        cli_session_id: Arc<Mutex<Option<String>>>,
    ) -> Result<Child, String> {
        let mut args = vec![
            "--print".to_string(),
            "--verbose".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
        ];

        // ── MCP server (permissions + ToolRegistry tools) ────────────────────
        // The combined "magick" MCP server exposes:
        //   - `ask` tool: intercepts permission requests → dialog in UI
        //   - All 23 ToolRegistry tools: notes, tasks, calendar, etc.
        // Writes to the app's own source files are auto-denied in the server.
        if let Some(config_path) = mcp_config_path {
            if let Some(path_str) = config_path.to_str() {
                args.push("--permission-prompt-tool".to_string());
                args.push("mcp__magick__ask".to_string());
                args.push("--mcp-config".to_string());
                args.push(path_str.to_string());
            }
        }

        // ── System prompt ────────────────────────────────────────────────────
        // Instructs Claude to use MCP tools for all data operations.
        args.push("--system-prompt".to_string());
        args.push(
            "Tu es Cookia, l'assistant IA de Magick Cookie. \
            Règles importantes : \
            1. Pour toutes les données (notes, tâches, calendrier, emails, snippets, contacts, \
            bookmarks, flux), utilise TOUJOURS les outils MCP disponibles \
            (ex: mcp__magick__notes_create, mcp__magick__task_create, etc.) — \
            ne lis ni n'écris jamais ces données via des fichiers directement. \
            2. Ne modifie JAMAIS les fichiers du code source de l'application Magick Cookie. \
            3. Tu peux lire et écrire les fichiers du projet de l'utilisateur ouvert dans l'IDE."
            .to_string()
        );

        // ── Prompt & session ──────────────────────────────────────────────────
        args.push("-p".to_string());
        args.push(prompt.to_string());

        if !model.is_empty() {
            args.push("--model".to_string());
            args.push(model.to_string());
        }

        if let Some(sid) = session_id {
            args.push("--resume".to_string());
            args.push(sid.to_string());
        }

        let mut cmd = Command::new(binary);
        cmd.args(&args)
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {e}"))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        // stdout reader thread — parse NDJSON and forward events
        let tx = event_tx.clone();
        let sid_capture = cli_session_id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim().to_string();
                if line.is_empty() { continue; }

                // Capture session_id from any NDJSON line
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(sid) = json.get("session_id").and_then(|v| v.as_str()) {
                        let mut lock = sid_capture.lock().unwrap();
                        if lock.is_none() {
                            *lock = Some(sid.to_string());
                        }
                    }
                }

                let events = parse_ndjson_line(&line);
                for event in events {
                    if tx.send(event).is_err() { return; }
                }
            }
            // Turn complete — process exited (normal for --print mode)
        });

        // stderr reader thread
        let tx_err = event_tx;
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim().to_string();
                if line.is_empty() { continue; }
                if line.contains("error") || line.contains("Error") || line.contains("FATAL") {
                    let _ = tx_err.send(AdapterEvent::Error { message: line });
                }
            }
        });

        Ok(child)
    }
}

impl BackendAdapter for ClaudeCliAdapter {
    fn start(
        &mut self,
        config: SessionConfig,
        event_tx: mpsc::Sender<AdapterEvent>,
    ) -> Result<(), String> {
        let binary = Self::find_binary()?;
        self.binary = binary.clone();
        self.cwd = config.cwd.clone();
        self.model = config.model.clone();
        self.event_tx = Some(event_tx.clone());
        self.alive = true;

        // If resuming an existing session, pre-fill the session_id
        if let Some(ref resume_id) = config.resume_session_id {
            *self.cli_session_id.lock().unwrap() = Some(resume_id.clone());
        }

        // ── Set up combined Magick MCP server ─────────────────────────────────
        let session_id = config.session_id.clone().unwrap_or_else(|| "unknown".to_string());
        let mcp_config_path = ensure_magick_mcp_script()
            .and_then(|script| write_mcp_config(&script, DEFAULT_API_URL, &session_id))
            .ok(); // Non-fatal: if MCP setup fails, Claude runs without MCP integration

        self.mcp_config_path = mcp_config_path.clone();

        // Spawn an initial turn to get the session_id and init event
        let child = Self::spawn_turn(
            &binary,
            &config.cwd,
            &config.model,
            "Reponds en une phrase: tu es pret.",
            config.resume_session_id.as_deref(),
            mcp_config_path.as_ref(),
            event_tx,
            self.cli_session_id.clone(),
        )?;

        self.current_process = Some(child);
        Ok(())
    }

    fn send_message(
        &mut self,
        content: String,
        _images: Option<Vec<ImageData>>,
    ) -> Result<(), String> {
        if !self.alive {
            return Err("Adapter not alive".into());
        }

        let tx = self.event_tx.as_ref().ok_or("No event channel")?.clone();

        // Kill any previous process that's still running
        if let Some(mut prev) = self.current_process.take() {
            match prev.try_wait() {
                Ok(Some(_)) => {} // already exited
                _ => { let _ = prev.kill(); let _ = prev.wait(); }
            }
        }

        // Get the session_id for --resume
        let session_id = self.cli_session_id.lock().unwrap().clone();

        let child = Self::spawn_turn(
            &self.binary,
            &self.cwd,
            &self.model,
            &content,
            session_id.as_deref(),
            self.mcp_config_path.as_ref(),
            tx,
            self.cli_session_id.clone(),
        )?;

        self.current_process = Some(child);
        Ok(())
    }

    fn respond_permission(
        &mut self,
        _request_id: String,
        _allowed: bool,
    ) -> Result<(), String> {
        // Permission flow is now handled via the MCP permission server:
        // Claude CLI → MCP server → API → frontend dialog → API resolve → MCP server → Claude CLI
        // The ai_respond_permission Tauri command is no longer needed for claude-cli.
        Ok(())
    }

    fn send_tool_result(
        &mut self,
        _tool_use_id: String,
        _content: String,
        _is_error: bool,
    ) -> Result<(), String> {
        Ok(())
    }

    fn interrupt(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.current_process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        Ok(())
    }

    fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.current_process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        // Clean up temp mcp-config file
        if let Some(ref path) = self.mcp_config_path {
            let _ = std::fs::remove_file(path);
        }
        self.alive = false;
        Ok(())
    }

    fn is_alive(&self) -> bool {
        self.alive
    }

    fn provider_name(&self) -> &str {
        "claude-cli"
    }

    fn capabilities(&self) -> AdapterCapabilities {
        AdapterCapabilities {
            supports_tools: true,
            supports_permissions: true, // now handled via MCP permission server
            supports_streaming: true,
            supports_images: false, // TODO: could pass via file
            supports_file_access: true,
            supports_terminal: true,
        }
    }
}

// ─── NDJSON parser (standalone function for use in threads) ───

fn parse_ndjson_line(line: &str) -> Vec<AdapterEvent> {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(line) else {
        return vec![];
    };

    let msg_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match msg_type {
        "system" => {
            let subtype = json.get("subtype").and_then(|v| v.as_str()).unwrap_or("");
            if subtype == "init" {
                let model = json.get("model").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                let tools = json.get("tools")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|t| {
                        t.as_str().map(|s| s.to_string())
                            .or_else(|| t.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                    }).collect())
                    .unwrap_or_default();
                return vec![AdapterEvent::SessionReady { model, tools }];
            }
            vec![]
        }

        "assistant" => {
            let content = extract_content(&json);
            let model = json.get("message")
                .and_then(|m| m.get("model"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let mut events = vec![];

            if let Some(blocks) = json.get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
            {
                for block in blocks {
                    if block.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                        let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let input = block.get("input").cloned().unwrap_or(serde_json::Value::Null);
                        events.push(AdapterEvent::ToolUse { id, name, input });
                    }
                }
            }

            if !content.is_empty() {
                events.push(AdapterEvent::AssistantMessage { content, model });
            }

            events
        }

        "result" => {
            let stop_reason = json.get("stop_reason")
                .or_else(|| json.get("result").and_then(|r| r.get("stop_reason")))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            vec![AdapterEvent::TurnComplete { stop_reason }]
        }

        "tool_use" => {
            let id = json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let name = json.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let input = json.get("input").cloned().unwrap_or(serde_json::Value::Null);
            vec![AdapterEvent::ToolUse { id, name, input }]
        }

        "tool_result" => {
            let tool_use_id = json.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let content = extract_tool_result_content(&json);
            let is_error = json.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
            vec![AdapterEvent::ToolResult { tool_use_id, content, is_error }]
        }

        _ => vec![]
    }
}

fn extract_content(json: &serde_json::Value) -> String {
    if let Some(blocks) = json.get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_array())
    {
        let texts: Vec<&str> = blocks.iter()
            .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
            .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
            .collect();
        if !texts.is_empty() {
            return texts.join("");
        }
    }
    json.get("content")
        .or_else(|| json.get("message").and_then(|m| m.get("content")))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn extract_tool_result_content(json: &serde_json::Value) -> String {
    if let Some(s) = json.get("content").and_then(|v| v.as_str()) {
        return s.to_string();
    }
    if let Some(arr) = json.get("content").and_then(|v| v.as_array()) {
        let texts: Vec<&str> = arr.iter()
            .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
            .collect();
        return texts.join("\n");
    }
    String::new()
}
