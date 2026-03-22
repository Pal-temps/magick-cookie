use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;

use crate::ai::adapter::BackendAdapter;
use crate::ai::types::*;

/// Claude Code CLI adapter.
/// Spawns `claude` CLI with stream-json I/O and bridges NDJSON ↔ AdapterEvent.
pub struct ClaudeCliAdapter {
    process: Option<Child>,
    alive: bool,
}

impl ClaudeCliAdapter {
    pub fn new() -> Self {
        Self {
            process: None,
            alive: false,
        }
    }

    /// Find the claude binary in PATH
    fn find_binary() -> Result<String, String> {
        // Try 'claude' directly
        if Command::new("claude")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Ok("claude".into());
        }
        Err("Claude CLI not found in PATH. Install it: https://docs.anthropic.com/en/docs/claude-code".into())
    }

    /// Parse a NDJSON line from Claude CLI stdout into AdapterEvent(s)
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
                        .map(|arr| arr.iter().filter_map(|t| t.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect())
                        .unwrap_or_default();
                    return vec![AdapterEvent::SessionReady { model, tools }];
                }
                vec![]
            }

            "assistant" => {
                let content = Self::extract_content(&json);
                let model = json.get("message").and_then(|m| m.get("model")).and_then(|v| v.as_str()).map(|s| s.to_string());

                let mut events = vec![];

                // Extract tool_use blocks from content_blocks
                if let Some(blocks) = json.get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_array())
                {
                    for block in blocks {
                        let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        if block_type == "tool_use" {
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

            "content_block_delta" | "stream_event" => {
                // Streaming token
                let delta = json.get("delta").or_else(|| json.get("event").and_then(|e| e.get("delta")));
                if let Some(delta) = delta {
                    let delta_type = delta.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    match delta_type {
                        "text_delta" => {
                            let text = delta.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            if !text.is_empty() {
                                return vec![AdapterEvent::StreamToken { text, phase: StreamPhase::Text }];
                            }
                        }
                        "thinking_delta" => {
                            let text = delta.get("thinking").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            if !text.is_empty() {
                                return vec![AdapterEvent::StreamToken { text, phase: StreamPhase::Thinking }];
                            }
                        }
                        _ => {}
                    }
                }
                vec![]
            }

            "result" => {
                let stop_reason = json.get("stop_reason").and_then(|v| v.as_str()).map(|s| s.to_string())
                    .or_else(|| json.get("result").and_then(|r| r.get("stop_reason")).and_then(|v| v.as_str()).map(|s| s.to_string()));

                // Extract tool_result if present
                let mut events = vec![];
                if let Some(subtype) = json.get("subtype").and_then(|v| v.as_str()) {
                    if subtype == "tool_result" {
                        let tool_use_id = json.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let content = json.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let is_error = json.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                        events.push(AdapterEvent::ToolResult { tool_use_id, content, is_error });
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
                let content = Self::extract_tool_result_content(&json);
                let is_error = json.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                vec![AdapterEvent::ToolResult { tool_use_id, content, is_error }]
            }

            "permission_request" | "control_request" => {
                let request_id = json.get("request_id")
                    .or_else(|| json.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let request = json.get("request").unwrap_or(&json);
                let tool_name = request.get("tool")
                    .or_else(|| request.get("tool_name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let tool_input = request.get("input")
                    .or_else(|| request.get("tool_input"))
                    .cloned()
                    .unwrap_or(serde_json::Value::Null);
                let description = request.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                vec![AdapterEvent::PermissionRequest { request_id, tool_name, tool_input, description }]
            }

            _ => vec![]
        }
    }

    fn extract_content(json: &serde_json::Value) -> String {
        // Try message.content as array of blocks
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

        // Try direct content string
        json.get("content")
            .or_else(|| json.get("message").and_then(|m| m.get("content")))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    }

    fn extract_tool_result_content(json: &serde_json::Value) -> String {
        // Content can be a string or array of content blocks
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
}

impl BackendAdapter for ClaudeCliAdapter {
    fn start(
        &mut self,
        config: SessionConfig,
        event_tx: mpsc::Sender<AdapterEvent>,
    ) -> Result<(), String> {
        let binary = Self::find_binary()?;

        let mut args = vec![
            "-p".to_string(),
            "".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--input-format".to_string(),
            "stream-json".to_string(),
        ];

        if !config.model.is_empty() {
            args.push("--model".to_string());
            args.push(config.model.clone());
        }

        let mut cmd = Command::new(&binary);
        cmd.args(&args)
            .current_dir(&config.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {e}"))?;
        self.alive = true;

        // Read stdout NDJSON in a background thread
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
        let tx = event_tx.clone();

        // stdout reader thread
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim().to_string();
                if line.is_empty() { continue; }

                let events = ClaudeCliAdapter::parse_ndjson_line(&line);
                for event in events {
                    if tx.send(event).is_err() { return; }
                }
            }
            // Process ended
            let _ = tx.send(AdapterEvent::SessionTerminated {
                reason: "CLI process stdout closed".into(),
            });
        });

        // stderr reader thread (emit errors)
        let tx_err = event_tx;
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim().to_string();
                if line.is_empty() { continue; }
                // Only emit real errors, not info/debug
                if line.contains("error") || line.contains("Error") || line.contains("FATAL") {
                    let _ = tx_err.send(AdapterEvent::Error { message: line });
                }
            }
        });

        self.process = Some(child);
        Ok(())
    }

    fn send_message(
        &mut self,
        content: String,
        _images: Option<Vec<ImageData>>,
    ) -> Result<(), String> {
        let child = self.process.as_mut().ok_or("No process running")?;
        let stdin = child.stdin.as_mut().ok_or("No stdin available")?;

        let msg = serde_json::json!({
            "type": "user_message",
            "content": content,
        });

        let mut line = serde_json::to_string(&msg).map_err(|e| format!("JSON error: {e}"))?;
        line.push('\n');

        stdin.write_all(line.as_bytes()).map_err(|e| format!("Write error: {e}"))?;
        stdin.flush().map_err(|e| format!("Flush error: {e}"))?;

        Ok(())
    }

    fn respond_permission(
        &mut self,
        request_id: String,
        allowed: bool,
    ) -> Result<(), String> {
        let child = self.process.as_mut().ok_or("No process running")?;
        let stdin = child.stdin.as_mut().ok_or("No stdin available")?;

        let msg = serde_json::json!({
            "type": "permission_response",
            "request_id": request_id,
            "behavior": if allowed { "allow" } else { "deny" },
        });

        let mut line = serde_json::to_string(&msg).map_err(|e| format!("JSON error: {e}"))?;
        line.push('\n');

        stdin.write_all(line.as_bytes()).map_err(|e| format!("Write error: {e}"))?;
        stdin.flush().map_err(|e| format!("Flush error: {e}"))?;

        Ok(())
    }

    fn interrupt(&mut self) -> Result<(), String> {
        // Send interrupt signal to the CLI process
        if let Some(child) = &mut self.process {
            // On Unix, send SIGINT; on Windows, just kill the process group
            #[cfg(unix)]
            {
                use std::os::unix::process::CommandExt;
                unsafe { libc::kill(child.id() as i32, libc::SIGINT); }
            }
            #[cfg(windows)]
            {
                // Windows: send Ctrl+C via stdin isn't reliable, try killing
                let _ = child.kill();
            }
        }
        Ok(())
    }

    fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
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
            supports_permissions: true,
            supports_streaming: true,
            supports_images: true,
            supports_file_access: true,
            supports_terminal: true,
        }
    }
}
