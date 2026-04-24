use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

use crate::ai::adapter::BackendAdapter;
use crate::ai::types::*;

/// Claude Code CLI adapter using `--resume` for multi-turn conversations.
///
/// Each message spawns a new `claude --print --verbose --output-format stream-json --resume <id>`
/// process. Claude CLI handles session persistence internally.
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
        event_tx: mpsc::Sender<AdapterEvent>,
        cli_session_id: Arc<Mutex<Option<String>>>,
    ) -> Result<Child, String> {
        let mut args = vec![
            "--print".to_string(),
            "--verbose".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "-p".to_string(),
            prompt.to_string(),
        ];

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

        // Spawn an initial turn to get the session_id and init event
        let child = Self::spawn_turn(
            &binary,
            &config.cwd,
            &config.model,
            "Reponds en une phrase: tu es pret.",
            config.resume_session_id.as_deref(),
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
            // Try to wait, kill if still running
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
        // Permission handling is not supported in --print/--resume mode
        // Claude CLI handles permissions based on --permission-mode flag
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
            supports_permissions: false, // not in --print mode
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
                        // tools can be strings or objects with "name" field
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

            // Extract tool_use blocks
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

            let mut events = vec![];

            // Extract final result text if present
            if let Some(result_text) = json.get("result").and_then(|v| v.as_str()) {
                if !result_text.is_empty() {
                    // Only emit if we haven't already from an "assistant" message
                    // The result field is a summary; the assistant message has the full content
                }
            }

            events.push(AdapterEvent::TurnComplete { stop_reason });
            events
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
