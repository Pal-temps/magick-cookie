use crate::ai::types::{AdapterCapabilities, AdapterEvent, ImageData, SessionConfig};
use std::sync::mpsc;

/// Trait that all AI providers must implement.
/// The session manager calls these methods; the adapter translates
/// provider-specific protocols into generic AdapterEvents.
#[allow(dead_code)]
pub trait BackendAdapter: Send {
    /// Start a session. The adapter should begin emitting events
    /// through the provided sender.
    fn start(
        &mut self,
        config: SessionConfig,
        event_tx: mpsc::Sender<AdapterEvent>,
    ) -> Result<(), String>;

    /// Send a user message to the AI.
    fn send_message(
        &mut self,
        content: String,
        images: Option<Vec<ImageData>>,
    ) -> Result<(), String>;

    /// Respond to a permission request (allow or deny).
    fn respond_permission(&mut self, request_id: String, allowed: bool) -> Result<(), String>;

    /// Send a tool result back to the AI (for built-in tools like screenshot).
    fn send_tool_result(
        &mut self,
        _tool_use_id: String,
        _content: String,
        _is_error: bool,
    ) -> Result<(), String> {
        Ok(()) // Default no-op for providers that don't support tools
    }

    /// Interrupt the current generation.
    fn interrupt(&mut self) -> Result<(), String>;

    /// Stop the session and clean up resources.
    fn stop(&mut self) -> Result<(), String>;

    /// Check if the backend process/connection is still alive.
    fn is_alive(&self) -> bool;

    /// Provider identifier (e.g. "claude-cli", "anthropic-api", "ollama").
    fn provider_name(&self) -> &str;

    /// What this provider supports.
    fn capabilities(&self) -> AdapterCapabilities;
}
