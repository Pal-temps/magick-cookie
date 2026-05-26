use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager};

use crate::ai::adapter::BackendAdapter;
use crate::ai::dedup::DedupState;
use crate::ai::event_buffer::EventBuffer;
use crate::ai::mcp_client::{McpManager, McpServerConfig, McpTool};
use crate::ai::session_recorder::SessionRecorder;
use crate::ai::types::*;

const MAX_SESSIONS: usize = 10;

// ─── Session ───

#[allow(dead_code)]
pub struct AiSession {
    pub id: String,
    pub adapter: Box<dyn BackendAdapter>,
    pub event_buffer: EventBuffer,
    pub dedup: DedupState,
    pub phase: SessionPhase,
    pub config: SessionConfig,
    pub recorder: Option<SessionRecorder>,
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

    pub fn add_session(&mut self, id: String, adapter: Box<dyn BackendAdapter>, config: SessionConfig, recorder: Option<SessionRecorder>) {
        let session = AiSession {
            id: id.clone(),
            adapter,
            event_buffer: EventBuffer::new(),
            dedup: DedupState::new(),
            phase: SessionPhase::Connecting,
            config,
            recorder,
        };
        self.sessions.insert(id, session);
    }

    pub fn get_session_mut(&mut self, id: &str) -> Option<&mut AiSession> {
        self.sessions.get_mut(id)
    }

    pub fn remove_session(&mut self, id: &str) {
        self.sessions.remove(id);
    }

    pub fn session_count(&self) -> usize {
        self.sessions.len()
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
pub type SharedMcpManager = Arc<Mutex<McpManager>>;

// ─── Helper: create adapter from provider name ───

fn create_adapter(provider: &str, config: &SessionConfig) -> Result<Box<dyn BackendAdapter>, String> {
    match provider {
        "claude-cli" => Ok(Box::new(crate::ai::adapters::claude_cli::ClaudeCliAdapter::new())),
        "anthropic-api" | "openai-api" | "gemini-api" | "ollama" | "lmstudio" => {
            Ok(Box::new(crate::ai::adapters::http_api::HttpApiAdapter::new(provider, config)?))
        }
        _ => Err(format!("Unknown provider: {}. Available: claude-cli, anthropic-api, openai-api, gemini-api, ollama, lmstudio", provider)),
    }
}

// ─── Helper: list available providers ───

fn detect_providers() -> Vec<ProviderInfo> {
    let mut providers = Vec::new();

    // Detect Claude CLI — try "claude" then "claude.cmd" (Windows npm global)
    let claude_available = std::process::Command::new("claude")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
        || std::process::Command::new("claude.cmd")
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
        ("gemini-api", "Gemini"),
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
                supports_images: id == "anthropic-api" || id == "openai-api" || id == "gemini-api",
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

    // Inject session_id into config so adapters (e.g. claude-cli MCP server) can use it
    let mut config = config;
    config.session_id = Some(session_id.clone());

    let mut adapter = create_adapter(&provider, &config)?;

    // Create channel for adapter → session manager
    let (event_tx, event_rx) = mpsc::channel::<AdapterEvent>();

    // Start the adapter
    adapter.start(config.clone(), event_tx)?;

    // Create session recorder (vault-backed JSONL)
    let recorder = crate::notes::load_config_pub(&app)
        .ok()
        .and_then(|cfg| {
            SessionRecorder::new(&cfg.path, &session_id, &provider, &config.model).ok()
        });

    // Add session (enforce maximum to prevent unbounded accumulation)
    {
        let mut mgr = state.lock().map_err(|e| format!("Lock error: {e}"))?;
        if mgr.session_count() >= MAX_SESSIONS {
            return Err(format!(
                "Maximum session count ({MAX_SESSIONS}) reached. Close unused sessions first."
            ));
        }
        mgr.add_session(session_id.clone(), adapter, config, recorder);
    }

    // Spawn a thread to forward adapter events to the frontend
    let app_handle = app.clone();
    let sid = session_id.clone();
    let state_clone = Arc::clone(&*state);
    let mcp_clone: SharedMcpManager = app.state::<SharedMcpManager>().inner().clone();

    std::thread::spawn(move || {
        for event in event_rx {
            // ─── MCP tool interception ───
            if let AdapterEvent::ToolUse { ref id, ref name, ref input } = event {
                if name.contains("__") || {
                    // Check if any connected MCP server provides this tool. A poisoned mutex
                    // here means another thread panicked with the lock — we degrade rather than
                    // crash the forwarder.
                    match mcp_clone.lock() {
                        Ok(mgr) => mgr.all_tools().iter().any(|(_, t)| t.name == *name),
                        Err(_) => false,
                    }
                } {
                    // Emit ToolUse event to frontend
                    {
                        let mut mgr = match state_clone.lock() {
                            Ok(m) => m,
                            Err(_) => break,
                        };
                        if let Some(session) = mgr.get_session_mut(&sid) {
                            let event_json = serde_json::to_string(&event).unwrap_or_default();
                            let seq = session.event_buffer.push(event_json);
                            if let Some(ref mut rec) = session.recorder {
                                rec.record(seq, &event);
                            }
                            let _ = app_handle.emit("ai-event", &AiEventPayload {
                                session_id: sid.clone(), seq, event: event.clone(),
                            });
                        }
                    }

                    // Execute MCP tool call
                    let tool_id = id.clone();
                    let tool_name = name.clone();
                    let args = input.clone();
                    let (content, is_error) = match mcp_clone.lock() {
                        Ok(mcp_mgr) => match mcp_mgr.call_tool(&tool_name, args) {
                            Ok(result) => (result, false),
                            Err(e) => (format!("MCP tool error: {e}"), true),
                        },
                        Err(_) => (
                            "MCP manager unavailable (mutex poisoned)".to_string(),
                            true,
                        ),
                    };

                    // Send result back to adapter + emit to frontend
                    {
                        let mut mgr = match state_clone.lock() {
                            Ok(m) => m,
                            Err(_) => break,
                        };
                        if let Some(session) = mgr.get_session_mut(&sid) {
                            let _ = session.adapter.send_tool_result(
                                tool_id.clone(), content.clone(), is_error,
                            );
                            let result_event = AdapterEvent::ToolResult {
                                tool_use_id: tool_id,
                                content,
                                is_error,
                            };
                            let ej = serde_json::to_string(&result_event).unwrap_or_default();
                            let seq = session.event_buffer.push(ej);
                            if let Some(ref mut rec) = session.recorder {
                                rec.record(seq, &result_event);
                            }
                            let _ = app_handle.emit("ai-event", &AiEventPayload {
                                session_id: sid.clone(), seq, event: result_event,
                            });
                        }
                    }
                    continue;
                }
            }

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
                            if let Some(ref mut rec) = session.recorder {
                                rec.record(seq, &event);
                            }
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
                            if let Some(ref mut rec) = session.recorder {
                                rec.record(seq, &result_event);
                            }
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

            // Record to JSONL
            if let Some(ref mut rec) = session.recorder {
                rec.record(seq, &event);
            }

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
    if let Some(ref mut rec) = session.recorder {
        rec.close();
    }
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

#[tauri::command]
pub fn ai_list_past_sessions(
    app: AppHandle,
) -> Result<Vec<crate::ai::session_recorder::PastSessionInfo>, String> {
    let config = crate::notes::load_config_pub(&app)?;
    Ok(crate::ai::session_recorder::list_past_sessions(&config.path))
}

#[tauri::command]
pub fn ai_read_past_session(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<String>, String> {
    let config = crate::notes::load_config_pub(&app)?;
    crate::ai::session_recorder::read_past_session(&config.path, &session_id)
}

#[tauri::command]
pub fn ai_update_session_label(
    app: AppHandle,
    session_id: String,
    label: String,
) -> Result<(), String> {
    let config = crate::notes::load_config_pub(&app)?;
    crate::ai::session_recorder::update_session_label(&config.path, &session_id, &label)
}

// ─── MCP Server Commands ───

#[derive(Debug, Clone, serde::Serialize)]
pub struct McpServerStatus {
    pub id: String,
    pub name: String,
    pub connected: bool,
    pub tools: Vec<McpTool>,
    pub enabled: bool,
    pub auto_connect: bool,
}

#[tauri::command]
pub fn mcp_list_servers(
    app: AppHandle,
) -> Result<Vec<McpServerStatus>, String> {
    let vault_config = crate::notes::load_config_pub(&app)?;
    let configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);

    Ok(configs
        .into_iter()
        .map(|c| McpServerStatus {
            id: c.id.clone(),
            name: c.name.clone(),
            connected: false,
            tools: Vec::new(),
            enabled: c.enabled,
            auto_connect: c.auto_connect,
        })
        .collect())
}

#[tauri::command]
pub fn mcp_add_server(
    app: AppHandle,
    config: McpServerConfig,
) -> Result<(), String> {
    let vault_config = crate::notes::load_config_pub(&app)?;
    let mut configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);

    // Replace if exists, otherwise add
    if let Some(pos) = configs.iter().position(|c| c.id == config.id) {
        configs[pos] = config;
    } else {
        configs.push(config);
    }

    crate::ai::mcp_client::save_mcp_configs(&vault_config.path, &configs)
}

#[tauri::command]
pub fn mcp_remove_server(
    app: AppHandle,
    mcp_state: tauri::State<'_, SharedMcpManager>,
    server_id: String,
) -> Result<(), String> {
    // Disconnect if connected
    {
        let mut mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;
        mgr.disconnect_server(&server_id);
    }

    let vault_config = crate::notes::load_config_pub(&app)?;
    let mut configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);
    configs.retain(|c| c.id != server_id);
    crate::ai::mcp_client::save_mcp_configs(&vault_config.path, &configs)
}

#[tauri::command]
pub fn mcp_connect_server(
    app: AppHandle,
    mcp_state: tauri::State<'_, SharedMcpManager>,
    server_id: String,
) -> Result<Vec<McpTool>, String> {
    let vault_config = crate::notes::load_config_pub(&app)?;
    let configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);

    let config = configs
        .iter()
        .find(|c| c.id == server_id)
        .ok_or_else(|| format!("Server '{}' not found", server_id))?;

    let mut mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;
    mgr.connect_server(config)
}

#[tauri::command]
pub fn mcp_disconnect_server(
    mcp_state: tauri::State<'_, SharedMcpManager>,
    server_id: String,
) -> Result<(), String> {
    let mut mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;
    mgr.disconnect_server(&server_id);
    Ok(())
}

#[tauri::command]
pub fn mcp_list_tools(
    mcp_state: tauri::State<'_, SharedMcpManager>,
) -> Result<Vec<McpTool>, String> {
    let mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;
    Ok(mgr.all_tools().into_iter().map(|(_, t)| t).collect())
}

#[tauri::command]
pub fn mcp_call_tool(
    mcp_state: tauri::State<'_, SharedMcpManager>,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<String, String> {
    let mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;
    mgr.call_tool(&tool_name, arguments)
}

#[tauri::command]
pub fn mcp_get_status(
    app: AppHandle,
    mcp_state: tauri::State<'_, SharedMcpManager>,
) -> Result<Vec<McpServerStatus>, String> {
    let vault_config = crate::notes::load_config_pub(&app)?;
    let configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);
    let mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;
    let connected = mgr.connected_servers();

    Ok(configs
        .into_iter()
        .map(|c| {
            let is_connected = connected.contains(&c.id);
            let tools = if is_connected {
                mgr.all_tools()
                    .into_iter()
                    .filter(|(sid, _)| *sid == c.id)
                    .map(|(_, t)| t)
                    .collect()
            } else {
                Vec::new()
            };
            McpServerStatus {
                id: c.id,
                name: c.name,
                connected: is_connected,
                tools,
                enabled: c.enabled,
                auto_connect: c.auto_connect,
            }
        })
        .collect())
}

#[tauri::command]
pub fn mcp_set_auto_connect(
    app: AppHandle,
    server_id: String,
    auto_connect: bool,
) -> Result<(), String> {
    let vault_config = crate::notes::load_config_pub(&app)?;
    let mut configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);

    if let Some(c) = configs.iter_mut().find(|c| c.id == server_id) {
        c.auto_connect = auto_connect;
    } else {
        return Err(format!("Server '{}' not found", server_id));
    }

    crate::ai::mcp_client::save_mcp_configs(&vault_config.path, &configs)
}

#[tauri::command]
pub fn mcp_auto_connect_all(
    app: AppHandle,
    mcp_state: tauri::State<'_, SharedMcpManager>,
) -> Result<Vec<String>, String> {
    let vault_config = crate::notes::load_config_pub(&app)?;
    let configs = crate::ai::mcp_client::load_mcp_configs(&vault_config.path);
    let mut mgr = mcp_state.lock().map_err(|e| format!("Lock: {e}"))?;

    let mut connected = Vec::new();
    for config in &configs {
        if config.auto_connect && config.enabled {
            match mgr.connect_server(config) {
                Ok(_) => connected.push(config.id.clone()),
                Err(e) => eprintln!("MCP auto-connect '{}' failed: {e}", config.name),
            }
        }
    }

    Ok(connected)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::adapter::BackendAdapter;
    use crate::ai::types::{AdapterCapabilities, AdapterEvent, ImageData, SessionConfig, SessionPhase};

    /// Mock adapter for testing SessionManager without Tauri runtime.
    struct MockAdapter;

    impl BackendAdapter for MockAdapter {
        fn start(&mut self, _config: SessionConfig, _event_tx: mpsc::Sender<AdapterEvent>) -> Result<(), String> {
            Ok(())
        }
        fn send_message(&mut self, _content: String, _images: Option<Vec<ImageData>>) -> Result<(), String> {
            Ok(())
        }
        fn respond_permission(&mut self, _request_id: String, _allowed: bool) -> Result<(), String> {
            Ok(())
        }
        fn interrupt(&mut self) -> Result<(), String> {
            Ok(())
        }
        fn stop(&mut self) -> Result<(), String> {
            Ok(())
        }
        fn is_alive(&self) -> bool {
            true
        }
        fn provider_name(&self) -> &str {
            "mock"
        }
        fn capabilities(&self) -> AdapterCapabilities {
            AdapterCapabilities {
                supports_tools: false,
                supports_permissions: false,
                supports_streaming: false,
                supports_images: false,
                supports_file_access: false,
                supports_terminal: false,
            }
        }
    }

    fn test_config() -> SessionConfig {
        SessionConfig {
            provider: "mock".into(),
            model: "test-model".into(),
            cwd: ".".into(),
            api_key: None,
            base_url: None,
            temperature: None,
            max_tokens: None,
            resume_session_id: None,
        }
    }

    #[test]
    fn test_session_manager_starts_empty() {
        let mgr = SessionManager::new();
        assert!(mgr.list_sessions().is_empty());
    }

    #[test]
    fn test_session_manager_default() {
        let mgr = SessionManager::default();
        assert!(mgr.list_sessions().is_empty());
    }

    #[test]
    fn test_sessions_map_cleanup() {
        let mut mgr = SessionManager::new();
        let n = 10;

        // Add N sessions
        for i in 0..n {
            let id = format!("session-{i}");
            mgr.add_session(id, Box::new(MockAdapter), test_config(), None);
        }
        assert_eq!(mgr.list_sessions().len(), n);

        // Remove all sessions
        for i in 0..n {
            mgr.remove_session(&format!("session-{i}"));
        }
        assert!(mgr.list_sessions().is_empty(), "HashMap should be empty after removing all sessions");
    }

    #[test]
    fn test_session_count_bounded() {
        let mut mgr = SessionManager::new();

        // Add sessions and verify count stays correct
        mgr.add_session("a".into(), Box::new(MockAdapter), test_config(), None);
        assert_eq!(mgr.list_sessions().len(), 1);

        mgr.add_session("b".into(), Box::new(MockAdapter), test_config(), None);
        assert_eq!(mgr.list_sessions().len(), 2);

        mgr.add_session("c".into(), Box::new(MockAdapter), test_config(), None);
        assert_eq!(mgr.list_sessions().len(), 3);

        // Remove one, count decreases
        mgr.remove_session("b");
        assert_eq!(mgr.list_sessions().len(), 2);

        // Verify correct sessions remain
        let sessions = mgr.list_sessions();
        assert!(sessions.contains(&"a".to_string()));
        assert!(sessions.contains(&"c".to_string()));
        assert!(!sessions.contains(&"b".to_string()));
    }

    #[test]
    fn test_get_session_mut() {
        let mut mgr = SessionManager::new();
        mgr.add_session("s1".into(), Box::new(MockAdapter), test_config(), None);

        // Existing session is accessible
        assert!(mgr.get_session_mut("s1").is_some());

        // Non-existent session returns None
        assert!(mgr.get_session_mut("nonexistent").is_none());
    }

    #[test]
    fn test_session_initial_phase() {
        let mut mgr = SessionManager::new();
        mgr.add_session("s1".into(), Box::new(MockAdapter), test_config(), None);

        let session = mgr.get_session_mut("s1").unwrap();
        assert_eq!(session.phase, SessionPhase::Connecting);
    }

    #[test]
    fn test_remove_nonexistent_session_is_noop() {
        let mut mgr = SessionManager::new();
        mgr.add_session("s1".into(), Box::new(MockAdapter), test_config(), None);

        // Removing a non-existent session should not panic or affect existing ones
        mgr.remove_session("nonexistent");
        assert_eq!(mgr.list_sessions().len(), 1);
    }

    #[test]
    fn test_duplicate_session_id_overwrites() {
        let mut mgr = SessionManager::new();
        mgr.add_session("s1".into(), Box::new(MockAdapter), test_config(), None);
        mgr.add_session("s1".into(), Box::new(MockAdapter), test_config(), None);

        // Should still be 1 session (HashMap overwrites)
        assert_eq!(mgr.list_sessions().len(), 1);
    }

    #[test]
    fn test_session_event_buffer_starts_empty() {
        let mut mgr = SessionManager::new();
        mgr.add_session("s1".into(), Box::new(MockAdapter), test_config(), None);

        let session = mgr.get_session_mut("s1").unwrap();
        assert!(session.event_buffer.is_empty());
        assert_eq!(session.event_buffer.len(), 0);
    }

    #[test]
    fn test_max_sessions_enforced() {
        // Verify the MAX_SESSIONS constant is set to a reasonable value.
        // This prevents unbounded accumulation of AI sessions in memory.
        assert_eq!(MAX_SESSIONS, 10, "MAX_SESSIONS should be 10 to limit memory usage");
        assert!(MAX_SESSIONS > 0, "MAX_SESSIONS must be positive");
        assert!(MAX_SESSIONS <= 50, "MAX_SESSIONS should not be excessively large");
    }

    #[test]
    fn test_session_manager_at_capacity() {
        // Verify that SessionManager correctly tracks count at the MAX_SESSIONS boundary.
        let mut mgr = SessionManager::new();

        // Fill to MAX_SESSIONS
        for i in 0..MAX_SESSIONS {
            mgr.add_session(format!("s-{i}"), Box::new(MockAdapter), test_config(), None);
        }
        assert_eq!(mgr.session_count(), MAX_SESSIONS);

        // The guard check (session_count() >= MAX_SESSIONS) should be true
        assert!(mgr.session_count() >= MAX_SESSIONS, "Should be at capacity");

        // Remove one — now under capacity
        mgr.remove_session("s-0");
        assert_eq!(mgr.session_count(), MAX_SESSIONS - 1);
        assert!(mgr.session_count() < MAX_SESSIONS, "Should be under capacity after removal");
    }
}
