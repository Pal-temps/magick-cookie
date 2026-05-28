use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;

use chrono::Utc;
use serde::Serialize;

use crate::ai::types::AdapterEvent;

// Session IDs are joined into a file path (`_sessions/{id}.jsonl`). Without validation the
// caller could escape the vault by passing `../../etc/passwd` or a name containing `/` / `\`.
// We accept only a conservative charset — alphanumerics, `-`, `_` — matching both UUIDs and
// the shorter internal identifiers used by the adapters.
fn validate_session_id(session_id: &str) -> Result<(), String> {
    if session_id.is_empty() || session_id.len() > 128 {
        return Err("Invalid session id: length must be 1..128".into());
    }
    if !session_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid session id: only [A-Za-z0-9_-] allowed".into());
    }
    Ok(())
}

#[derive(Serialize)]
struct SessionMeta {
    #[serde(rename = "type")]
    record_type: &'static str,
    session_id: String,
    provider: String,
    model: String,
    started_at: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    label: String,
}

#[derive(Serialize)]
struct EventRecord<'a> {
    ts: String,
    seq: u32,
    event: &'a AdapterEvent,
}

pub struct SessionRecorder {
    writer: BufWriter<File>,
}

impl SessionRecorder {
    pub fn new(
        vault_path: &str,
        session_id: &str,
        provider: &str,
        model: &str,
    ) -> Result<Self, String> {
        validate_session_id(session_id)?;
        let dir = PathBuf::from(vault_path).join("_sessions");
        fs::create_dir_all(&dir).map_err(|e| format!("mkdir _sessions: {e}"))?;

        let file_path = dir.join(format!("{session_id}.jsonl"));
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| format!("Open session file: {e}"))?;

        let mut writer = BufWriter::new(file);

        // Write metadata header
        let meta = SessionMeta {
            record_type: "session_meta",
            session_id: session_id.to_string(),
            provider: provider.to_string(),
            model: model.to_string(),
            started_at: Utc::now().to_rfc3339(),
            label: String::new(),
        };
        let line = serde_json::to_string(&meta).unwrap_or_default();
        writeln!(writer, "{line}").map_err(|e| format!("Write meta: {e}"))?;
        writer.flush().map_err(|e| format!("Flush meta: {e}"))?;

        Ok(Self { writer })
    }

    pub fn record(&mut self, seq: u32, event: &AdapterEvent) {
        let record = EventRecord {
            ts: Utc::now().to_rfc3339(),
            seq,
            event,
        };
        if let Ok(line) = serde_json::to_string(&record) {
            let _ = writeln!(self.writer, "{line}");
            let _ = self.writer.flush();
        }
    }

    pub fn close(&mut self) {
        let _ = self.writer.flush();
    }
}

// ─── List past sessions ───

#[derive(Debug, Clone, Serialize)]
pub struct PastSessionInfo {
    pub session_id: String,
    pub provider: String,
    pub model: String,
    pub started_at: String,
    pub label: String,
    pub event_count: usize,
}

pub fn list_past_sessions(vault_path: &str) -> Vec<PastSessionInfo> {
    let dir = PathBuf::from(vault_path).join("_sessions");
    let mut sessions = Vec::new();

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return sessions,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        let session_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        if session_id.is_empty() {
            continue;
        }

        // Read first line for metadata
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let lines: Vec<&str> = content.lines().collect();
        if lines.is_empty() {
            continue;
        }

        let mut provider = String::new();
        let mut model = String::new();
        let mut started_at = String::new();
        let mut label = String::new();

        // Parse metadata from first line
        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(lines[0]) {
            if meta.get("type").and_then(|t| t.as_str()) == Some("session_meta") {
                provider = meta
                    .get("provider")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                model = meta
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                started_at = meta
                    .get("started_at")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                label = meta
                    .get("label")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
            }
        }

        // Event count = total lines - 1 (metadata line)
        let event_count = if lines.len() > 1 { lines.len() - 1 } else { 0 };

        sessions.push(PastSessionInfo {
            session_id,
            provider,
            model,
            started_at,
            label,
            event_count,
        });
    }

    // Sort by started_at descending (newest first)
    sessions.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    sessions
}

pub fn read_past_session(vault_path: &str, session_id: &str) -> Result<Vec<String>, String> {
    validate_session_id(session_id)?;
    let path = PathBuf::from(vault_path)
        .join("_sessions")
        .join(format!("{session_id}.jsonl"));

    if !path.exists() {
        return Err("Session file not found".into());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Read error: {e}"))?;
    Ok(content.lines().map(String::from).collect())
}

pub fn update_session_label(vault_path: &str, session_id: &str, label: &str) -> Result<(), String> {
    validate_session_id(session_id)?;
    let path = PathBuf::from(vault_path)
        .join("_sessions")
        .join(format!("{session_id}.jsonl"));

    if !path.exists() {
        return Err("Session file not found".into());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Read error: {e}"))?;
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if lines.is_empty() {
        return Err("Empty session file".into());
    }

    // Update metadata line
    if let Ok(mut meta) = serde_json::from_str::<serde_json::Value>(&lines[0]) {
        if let Some(obj) = meta.as_object_mut() {
            obj.insert("label".into(), serde_json::Value::String(label.to_string()));
            lines[0] = serde_json::to_string(&meta).unwrap_or(lines[0].clone());
        }
    }

    fs::write(&path, lines.join("\n") + "\n").map_err(|e| format!("Write error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::{AdapterEvent, StreamPhase};

    #[test]
    fn test_recorder_creates_file_and_records() {
        let tmp = std::env::temp_dir().join("mc-test-recorder");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let vault = tmp.to_str().unwrap();
        let mut rec = SessionRecorder::new(vault, "test-session-1", "claude-cli", "opus").unwrap();

        rec.record(
            1,
            &AdapterEvent::SessionReady {
                model: "opus".into(),
                tools: vec!["read".into()],
            },
        );
        rec.record(
            2,
            &AdapterEvent::StreamToken {
                text: "Hello".into(),
                phase: StreamPhase::Text,
            },
        );
        rec.close();

        let file = tmp.join("_sessions").join("test-session-1.jsonl");
        assert!(file.exists());

        let content = fs::read_to_string(&file).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 3); // meta + 2 events

        // Verify metadata
        let meta: serde_json::Value = serde_json::from_str(lines[0]).unwrap();
        assert_eq!(meta["type"], "session_meta");
        assert_eq!(meta["session_id"], "test-session-1");
        assert_eq!(meta["provider"], "claude-cli");

        // Verify event records
        let ev1: serde_json::Value = serde_json::from_str(lines[1]).unwrap();
        assert_eq!(ev1["seq"], 1);
        assert!(ev1["ts"].as_str().unwrap().len() > 10);
        assert_eq!(ev1["event"]["type"], "session_ready");

        let ev2: serde_json::Value = serde_json::from_str(lines[2]).unwrap();
        assert_eq!(ev2["seq"], 2);
        assert_eq!(ev2["event"]["type"], "stream_token");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_list_past_sessions() {
        let tmp = std::env::temp_dir().join("mc-test-list-sessions");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let vault = tmp.to_str().unwrap();
        let mut rec = SessionRecorder::new(vault, "s1", "anthropic-api", "sonnet").unwrap();
        rec.record(
            1,
            &AdapterEvent::TurnComplete {
                stop_reason: Some("end_turn".into()),
            },
        );
        rec.close();

        let sessions = list_past_sessions(vault);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, "s1");
        assert_eq!(sessions[0].provider, "anthropic-api");
        assert_eq!(sessions[0].model, "sonnet");
        assert_eq!(sessions[0].event_count, 1);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_update_session_label() {
        let tmp = std::env::temp_dir().join("mc-test-label");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let vault = tmp.to_str().unwrap();
        let mut rec = SessionRecorder::new(vault, "s2", "claude-cli", "opus").unwrap();
        rec.close();

        update_session_label(vault, "s2", "My session").unwrap();

        let sessions = list_past_sessions(vault);
        assert_eq!(sessions[0].label, "My session");

        let _ = fs::remove_dir_all(&tmp);
    }
}
