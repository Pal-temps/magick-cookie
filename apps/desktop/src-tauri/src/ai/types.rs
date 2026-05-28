use serde::{Deserialize, Serialize};

// ─── Stream phase ───

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StreamPhase {
    Thinking,
    Text,
}

// ─── Provider capabilities ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterCapabilities {
    pub supports_tools: bool,
    pub supports_permissions: bool,
    pub supports_streaming: bool,
    pub supports_images: bool,
    pub supports_file_access: bool,
    pub supports_terminal: bool,
}

// ─── Session config ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub provider: String,
    pub model: String,
    pub cwd: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub resume_session_id: Option<String>,
    /// Tauri session id — injected by ai_start_session, not sent from frontend.
    /// Used by the MCP permission server to identify the session in the API.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

// ─── Image data ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    pub media_type: String,
    pub data: String, // base64
}

// ─── Session phase ───

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionPhase {
    Connecting,
    Ready,
    Terminated,
}

// ─── Adapter events (provider → frontend) ───

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AdapterEvent {
    /// Session initialized, ready to receive messages
    SessionReady { model: String, tools: Vec<String> },

    /// Streaming token (text or thinking)
    StreamToken { text: String, phase: StreamPhase },

    /// Complete assistant message
    AssistantMessage {
        content: String,
        model: Option<String>,
    },

    /// Tool invocation started
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },

    /// Tool result received
    ToolResult {
        tool_use_id: String,
        content: String,
        is_error: bool,
    },

    /// Permission request from the AI
    PermissionRequest {
        request_id: String,
        tool_name: String,
        tool_input: serde_json::Value,
        description: String,
    },

    /// Permission request cancelled
    PermissionCancelled { request_id: String },

    /// Tool execution progress
    ToolProgress {
        tool_use_id: String,
        tool_name: String,
        elapsed_seconds: f32,
    },

    /// Turn complete (AI finished responding)
    TurnComplete { stop_reason: Option<String> },

    /// Error
    Error { message: String },

    /// Session terminated
    SessionTerminated { reason: String },
}

// ─── Event wrapper (sent to frontend via Tauri emit) ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiEventPayload {
    pub session_id: String,
    pub seq: u32,
    pub event: AdapterEvent,
}

// ─── Provider info ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub available: bool,
    pub capabilities: AdapterCapabilities,
}
