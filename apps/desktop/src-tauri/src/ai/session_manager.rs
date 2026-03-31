use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex};

use tauri::{AppHandle, Emitter};

use crate::ai::adapter::BackendAdapter;
use crate::ai::dedup::DedupState;
use crate::ai::event_buffer::EventBuffer;
use crate::ai::types::*;

// ─── Session ───

#[allow(dead_code)]
pub struct AiSession {
    pub id: String,
    pub adapter: Box<dyn BackendAdapter>,
    pub event_buffer: EventBuffer,
    pub dedup: DedupState,
    pub phase: SessionPhase,
    pub config: SessionConfig,
}

// ─── Session Manager (shared state) ───

pub struct SessionManager {
    sessions: HashMap<String, AiSession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn add_session(&mut self, id: String, adapter: Box<dyn BackendAdapter>, config: SessionConfig) {
        let session = AiSession {
            id: id.clone(),
            adapter,
            event_buffer: EventBuffer::new(),
            dedup: DedupState::new(),
            phase: SessionPhase::Connecting,
            config,
        };
        self.sessions.insert(id, session);
    }

    pub fn get_session_mut(&mut self, id: &str) -> Option<&mut AiSession> {
        self.sessions.get_mut(id)
    }

    pub fn remove_session(&mut self, id: &str) {
        self.sessions.remove(id);
    }

    pub fn list_sessions(&self) -> Vec<String> {
        self.sessions.keys().cloned().collect()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tauri State ───

pub type SharedSessionManager = Arc<Mutex<SessionManager>>;

// ─── Helper: create adapter from provider name ───

fn create_adapter(provider: &str, config: &SessionConfig) -> Result<Box<dyn BackendAdapter>, String> {
    match provider {
        "claude-cli" => Ok(Box::new(crate::ai::adapters::claude_cli::ClaudeCliAdapter::new())),
        "anthropic-api" | "openai-api" | "ollama" | "lmstudio" => {
            Ok(Box::new(crate::ai::adapters::http_api::HttpApiAdapter::new(provider, config)?))
        }
        _ => Err(format!("Unknown provider: {}. Available: claude-cli, anthropic-api, openai-api, ollama, lmstudio", provider)),
    }
}

// ─── Helper: list available providers ───

fn detect_providers() -> Vec<ProviderInfo> {
    let mut providers = Vec::new();

    // Detect Claude CLI
    let claude_available = std::process::Command::new("claude")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    providers.push(ProviderInfo {
        id: "claude-cli".into(),
        name: "Claude Code CLI".into(),
        available: claude_available,
        capabilities: AdapterCapabilities {
            supports_tools: true,
            supports_permissions: true,
            supports_streaming: true,
            supports_images: true,
            supports_file_access: true,
            supports_terminal: true,
        },
    });

    // API providers are always "available" (config may be missing but we can try)
    for (id, name) in [
        ("anthropic-api", "Anthropic API"),
        ("openai-api", "OpenAI API"),
        ("ollama", "Ollama (local)"),
        ("lmstudio", "LM Studio (local)"),
    ] {
        providers.push(ProviderInfo {
            id: id.into(),
            name: name.into(),
            available: true,
            capabilities: AdapterCapabilities {
                supports_tools: false,
                supports_permissions: false,
                supports_streaming: true,
                supports_images: id == "anthropic-api" || id == "openai-api",
                supports_file_access: false,
                supports_terminal: false,
            },
        });
    }

    providers
}

// ─── Tauri Commands ───

#[tauri::command]
pub fn ai_list_providers() -> Vec<ProviderInfo> {
    detect_providers()
}

#[tauri::command]
pub fn ai_get_capabilities(provider: String) -> Result<AdapterCapabilities, String> {
    detect_providers()
        .into_iter()
        .find(|p| p.id == provider)
        .map(|p| p.capabilities)
        .ok_or_else(|| format!("Unknown provider: {provider}"))
}

#[tauri::command]
pub fn ai_start_session(
    app: AppHandle,
    state: tauri::State<'_, SharedSessionManager>,
    provider: String,
    config: SessionConfig,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let mut adapter = create_adapter(&provider, &config)?;

    // Create channel for adapter → session manager
    let (event_tx, event_rx) = mpsc::channel::<AdapterEvent>();

    // Start the adapter
    adapter.start(config.clone(), event_tx)?;

    // Add session
    {
        let mut mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
        mgr.add_session(session_id.clone(), adapter, config);
    }

    // Spawn a thread to forward adapter events to the frontend
    let app_handle = app.clone();
    let sid = session_id.clone();
    let state_clone = Arc::clone(&*state);

    std::thread::spawn(move || {
        for event in event_rx {
            // ─── Built-in tool interception (screenshot) ───
            if let AdapterEvent::ToolUse { ref id, ref name, ref input } = event {
                if name == "screenshot" {
                    // Emit the ToolUse event to frontend first (so it shows in the UI)
                    {
                        let mut mgr = match state_clone.lock() {
                            Ok(m) => m,
                            Err(_) => break,
                        };
                        if let Some(session) = mgr.get_session_mut(&sid) {
                            let event_json = serde_json::to_string(&event).unwrap_or_default();
                            let seq = session.event_buffer.push(event_json);
                            let _ = app_handle.emit("ai-event", &AiEventPayload {
                                session_id: sid.clone(), seq, event: event.clone(),
                            });
                        }
                    }
                    // Release lock, execute capture
                    let tool_id = id.clone();
                    let region = input.get("region");
                    let result = if let Some(r) = region {
                        let x = r.get("x").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        let y = r.get("y").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        let w = r.get("width").and_then(|v| v.as_u64()).unwrap_or(800) as u32;
                        let h = r.get("height").and_then(|v| v.as_u64()).unwrap_or(600) as u32;
                        crate::screenshot::capture_app_region(app_handle.clone(), x, y, w, h)
                    } else {
                        crate::screenshot::capture_app_screenshot(app_handle.clone())
                    };

                    // Send tool result back to adapter + emit to frontend
                    let (content, is_error) = match result {
                        Ok(img) => {
                            // Return image as a JSON payload the AI can reference
                            let json = serde_json::json!({
                                "image": { "media_type": img.media_type, "data": img.data },
                                "width_hint": "max 1280px, resized for AI",
                            });
                            (serde_json::to_string(&json).unwrap_or_default(), false)
                        }
                        Err(e) => (format!("Screenshot failed: {e}"), true),
                    };

                    {
                        let mut mgr = match state_clone.lock() {
                            Ok(m) => m,
                            Err(_) => break,
                        };
                        if let Some(session) = mgr.get_session_mut(&sid) {
                            // Send result to adapter (so AI continues)
                            let _ = session.adapter.send_tool_result(
                                tool_id.clone(), content.clone(), is_error,
                            );
                            // Emit ToolResult to frontend
                            let result_event = AdapterEvent::ToolResult {
                                tool_use_id: tool_id,
                                content,
                                is_error,
                            };
                            let ej = serde_json::to_string(&result_event).unwrap_or_default();
                            let seq = session.event_buffer.push(ej);
                            let _ = app_handle.emit("ai-event", &AiEventPayload {
                                session_id: sid.clone(), seq, event: result_event,
                            });
                        }
                    }
                    continue; // Don't process this event further
                }
            }

            // ─── Normal event forwarding ───
            let mut mgr = match state_clone.lock() {
                Ok(m) => m,
                Err(_) => break,
            };

            let session = match mgr.get_session_mut(&sid) {
                Some(s) => s,
                None => break,
            };

            // Update phase on key events
            match &event {
                AdapterEvent::SessionReady { .. } => {
                    session.phase = SessionPhase::Ready;
                }
                AdapterEvent::SessionTerminated { .. } | AdapterEvent::Error { .. } => {
                    session.phase = SessionPhase::Terminated;
                }
                _ => {}
            }

            // Serialize and buffer
            let event_json = match serde_json::to_string(&event) {
                Ok(j) => j,
                Err(_) => continue,
            };

            // Dedup (skip duplicates)
            let is_dup = match &event {
                AdapterEvent::StreamToken { .. } => false, // never dedup stream tokens
                AdapterEvent::ToolProgress { .. } => false,
                _ => session.dedup.is_duplicate(&event_json),
            };

            if is_dup {
                continue;
            }

            let seq = session.event_buffer.push(event_json);

            // Emit to frontend
            let payload = AiEventPayload {
                session_id: sid.clone(),
                seq,
                event,
            };

            let _ = app_handle.emit("ai-event", &payload);
        }
    });

    Ok(session_id)
}

#[tauri::command]
pub fn ai_send_message(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
    content: String,
    images: Option<Vec<ImageData>>,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    let session = mgr
        .get_session_mut(&session_id)
        .ok_or("Session not found")?;
    session.adapter.send_message(content, images)
}

#[tauri::command]
pub fn ai_respond_permission(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
    request_id: String,
    allowed: bool,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    let session = mgr
        .get_session_mut(&session_id)
        .ok_or("Session not found")?;
    session.adapter.respond_permission(request_id, allowed)
}

#[tauri::command]
pub fn ai_interrupt(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    let session = mgr
        .get_session_mut(&session_id)
        .ok_or("Session not found")?;
    session.adapter.interrupt()
}

#[tauri::command]
pub fn ai_stop_session(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    let session = mgr
        .get_session_mut(&session_id)
        .ok_or("Session not found")?;
    session.adapter.stop()?;
    mgr.remove_session(&session_id);
    Ok(())
}

#[tauri::command]
pub fn ai_list_sessions(
    state: tauri::State<'_, SharedSessionManager>,
) -> Result<Vec<String>, String> {
    let mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    Ok(mgr.list_sessions())
}
