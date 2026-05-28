use std::sync::mpsc;
use std::thread;

use crate::ai::adapter::BackendAdapter;
use crate::ai::types::*;

// ─── Provider enum ───

#[derive(Debug, Clone)]
pub enum ApiProvider {
    Anthropic,
    OpenAi,
    Gemini,
    Ollama,
    LmStudio,
}

impl ApiProvider {
    fn from_str(s: &str) -> Option<Self> {
        match s {
            "anthropic-api" => Some(Self::Anthropic),
            "openai-api" => Some(Self::OpenAi),
            "gemini-api" => Some(Self::Gemini),
            "ollama" => Some(Self::Ollama),
            "lmstudio" => Some(Self::LmStudio),
            _ => None,
        }
    }

    fn default_base_url(&self) -> &str {
        match self {
            Self::Anthropic => "https://api.anthropic.com",
            Self::OpenAi => "https://api.openai.com",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta/openai",
            Self::Ollama => "http://localhost:11434",
            Self::LmStudio => "http://localhost:1234",
        }
    }
}

// ─── Chat message for conversation history ───

#[derive(Debug, Clone, serde::Serialize)]
struct ChatMessage {
    role: String,
    content: serde_json::Value, // String or array of content blocks (for images)
}

// ─── HTTP API Adapter ───

pub struct HttpApiAdapter {
    provider: ApiProvider,
    base_url: String,
    api_key: Option<String>,
    model: String,
    temperature: f32,
    max_tokens: u32,
    history: std::sync::Arc<std::sync::Mutex<Vec<ChatMessage>>>,
    alive: bool,
    event_tx: Option<mpsc::Sender<AdapterEvent>>,
}

impl HttpApiAdapter {
    pub fn new(provider_str: &str, config: &SessionConfig) -> Result<Self, String> {
        let provider = ApiProvider::from_str(provider_str)
            .ok_or_else(|| format!("Unknown API provider: {provider_str}"))?;

        let base_url = config
            .base_url
            .clone()
            .unwrap_or_else(|| provider.default_base_url().to_string());

        Ok(Self {
            provider,
            base_url,
            api_key: config.api_key.clone(),
            model: config.model.clone(),
            temperature: config.temperature.unwrap_or(0.7),
            max_tokens: config.max_tokens.unwrap_or(4096),
            history: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            alive: false,
            event_tx: None,
        })
    }

    /// Build the HTTP request body based on the provider
    fn build_request_body(&self) -> serde_json::Value {
        let history = self.history.lock().unwrap();
        let messages: Vec<serde_json::Value> = history
            .iter()
            .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
            .collect();
        drop(history);

        match self.provider {
            ApiProvider::Anthropic => {
                serde_json::json!({
                    "model": self.model,
                    "max_tokens": self.max_tokens,
                    "stream": true,
                    "messages": messages,
                })
            }
            ApiProvider::OpenAi | ApiProvider::Gemini | ApiProvider::LmStudio => {
                serde_json::json!({
                    "model": self.model,
                    "max_tokens": self.max_tokens,
                    "temperature": self.temperature,
                    "stream": true,
                    "messages": messages,
                })
            }
            ApiProvider::Ollama => {
                serde_json::json!({
                    "model": self.model,
                    "stream": true,
                    "messages": messages,
                    "options": {
                        "temperature": self.temperature,
                        "num_predict": self.max_tokens,
                    }
                })
            }
        }
    }

    /// Get the API endpoint URL
    fn endpoint_url(&self) -> String {
        match self.provider {
            ApiProvider::Anthropic => format!("{}/v1/messages", self.base_url),
            ApiProvider::OpenAi | ApiProvider::LmStudio => {
                format!("{}/v1/chat/completions", self.base_url)
            }
            ApiProvider::Gemini => format!("{}/chat/completions", self.base_url),
            ApiProvider::Ollama => format!("{}/api/chat", self.base_url),
        }
    }

    /// Parse a SSE line from Anthropic streaming
    fn parse_anthropic_sse(data: &str) -> Vec<AdapterEvent> {
        let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
            return vec![];
        };

        let event_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match event_type {
            "message_start" => {
                let model = json
                    .get("message")
                    .and_then(|m| m.get("model"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                vec![AdapterEvent::SessionReady {
                    model,
                    tools: vec![],
                }]
            }
            "content_block_delta" => {
                let delta = json.get("delta").unwrap_or(&serde_json::Value::Null);
                let delta_type = delta.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match delta_type {
                    "text_delta" => {
                        let text = delta
                            .get("text")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        if text.is_empty() {
                            vec![]
                        } else {
                            vec![AdapterEvent::StreamToken {
                                text,
                                phase: StreamPhase::Text,
                            }]
                        }
                    }
                    "thinking_delta" => {
                        let text = delta
                            .get("thinking")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        if text.is_empty() {
                            vec![]
                        } else {
                            vec![AdapterEvent::StreamToken {
                                text,
                                phase: StreamPhase::Thinking,
                            }]
                        }
                    }
                    _ => vec![],
                }
            }
            "message_delta" => {
                let stop = json
                    .get("delta")
                    .and_then(|d| d.get("stop_reason"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                if stop.is_some() {
                    vec![AdapterEvent::TurnComplete { stop_reason: stop }]
                } else {
                    vec![]
                }
            }
            "message_stop" => {
                vec![AdapterEvent::TurnComplete {
                    stop_reason: Some("end_turn".into()),
                }]
            }
            "error" => {
                let msg = json
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                vec![AdapterEvent::Error { message: msg }]
            }
            _ => vec![],
        }
    }

    /// Parse a SSE line from OpenAI streaming
    fn parse_openai_sse(data: &str) -> Vec<AdapterEvent> {
        if data == "[DONE]" {
            return vec![AdapterEvent::TurnComplete {
                stop_reason: Some("stop".into()),
            }];
        }

        let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
            return vec![];
        };

        let choice = json.get("choices").and_then(|c| c.get(0));
        let Some(choice) = choice else {
            return vec![];
        };

        let finish = choice.get("finish_reason").and_then(|v| v.as_str());
        if let Some(reason) = finish {
            if reason != "null" {
                return vec![AdapterEvent::TurnComplete {
                    stop_reason: Some(reason.to_string()),
                }];
            }
        }

        let delta = choice.get("delta").unwrap_or(&serde_json::Value::Null);
        let content = delta.get("content").and_then(|v| v.as_str()).unwrap_or("");
        if !content.is_empty() {
            vec![AdapterEvent::StreamToken {
                text: content.to_string(),
                phase: StreamPhase::Text,
            }]
        } else {
            vec![]
        }
    }

    /// Parse a NDJSON line from Ollama streaming
    fn parse_ollama_ndjson(line: &str) -> Vec<AdapterEvent> {
        let Ok(json) = serde_json::from_str::<serde_json::Value>(line) else {
            return vec![];
        };

        let done = json.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
        if done {
            return vec![AdapterEvent::TurnComplete {
                stop_reason: Some("stop".into()),
            }];
        }

        let content = json
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if !content.is_empty() {
            vec![AdapterEvent::StreamToken {
                text: content.to_string(),
                phase: StreamPhase::Text,
            }]
        } else {
            vec![]
        }
    }

    /// Process the streaming response in a background thread
    fn stream_response(&self, event_tx: mpsc::Sender<AdapterEvent>) {
        let url = self.endpoint_url();
        let body = self.build_request_body();
        let provider = self.provider.clone();
        let api_key = self.api_key.clone();
        let history = self.history.clone();

        thread::spawn(move || {
            let mut accumulated_content = String::new();
            // Use a blocking HTTP client (reqwest::blocking) to keep things simple
            let client = reqwest::blocking::Client::new();
            let mut req = client.post(&url).header("Content-Type", "application/json");

            // Auth headers
            match &provider {
                ApiProvider::Anthropic => {
                    if let Some(key) = &api_key {
                        req = req.header("x-api-key", key);
                        req = req.header("anthropic-version", "2023-06-01");
                    }
                }
                ApiProvider::OpenAi | ApiProvider::Gemini => {
                    if let Some(key) = &api_key {
                        req = req.header("Authorization", format!("Bearer {key}"));
                    }
                }
                _ => {} // Ollama/LmStudio don't need auth
            }

            let response = match req.body(body.to_string()).send() {
                Ok(r) => r,
                Err(e) => {
                    let _ = event_tx.send(AdapterEvent::Error {
                        message: format!("HTTP error: {e}"),
                    });
                    let _ = event_tx.send(AdapterEvent::TurnComplete {
                        stop_reason: Some("error".into()),
                    });
                    return;
                }
            };

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().unwrap_or_default();
                let _ = event_tx.send(AdapterEvent::Error {
                    message: format!("API error {status}: {body}"),
                });
                let _ = event_tx.send(AdapterEvent::TurnComplete {
                    stop_reason: Some("error".into()),
                });
                return;
            }

            // Read the streaming response line by line
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(response);

            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim().to_string();
                if line.is_empty() {
                    continue;
                }

                let events = match &provider {
                    ApiProvider::Anthropic => {
                        // SSE format: "data: {...}"
                        if let Some(data) = line.strip_prefix("data: ") {
                            Self::parse_anthropic_sse(data)
                        } else {
                            vec![]
                        }
                    }
                    ApiProvider::OpenAi | ApiProvider::Gemini | ApiProvider::LmStudio => {
                        // SSE format: "data: {...}" or "data: [DONE]"
                        if let Some(data) = line.strip_prefix("data: ") {
                            Self::parse_openai_sse(data)
                        } else {
                            vec![]
                        }
                    }
                    ApiProvider::Ollama => {
                        // NDJSON: one JSON object per line
                        Self::parse_ollama_ndjson(&line)
                    }
                };

                for event in events {
                    // Accumulate text content for history
                    if let AdapterEvent::StreamToken { ref text, .. } = event {
                        accumulated_content.push_str(text);
                    }
                    if event_tx.send(event).is_err() {
                        return;
                    }
                }
            }

            // Add assistant response to history for context in next turn
            if !accumulated_content.is_empty() {
                if let Ok(mut h) = history.lock() {
                    h.push(ChatMessage {
                        role: "assistant".into(),
                        content: serde_json::json!(accumulated_content),
                    });
                }
            }
        });
    }
}

impl BackendAdapter for HttpApiAdapter {
    fn start(
        &mut self,
        _config: SessionConfig,
        event_tx: mpsc::Sender<AdapterEvent>,
    ) -> Result<(), String> {
        self.alive = true;
        self.event_tx = Some(event_tx.clone());

        // Emit ready immediately (no CLI to wait for)
        let _ = event_tx.send(AdapterEvent::SessionReady {
            model: self.model.clone(),
            tools: vec![],
        });

        Ok(())
    }

    fn send_message(
        &mut self,
        content: String,
        images: Option<Vec<ImageData>>,
    ) -> Result<(), String> {
        if !self.alive {
            return Err("Session not started".into());
        }

        let event_tx = self
            .event_tx
            .as_ref()
            .ok_or("Event channel not initialized — call start() first")?
            .clone();

        // Build content: plain string or array with image blocks
        let msg_content = if let Some(imgs) = images.filter(|v| !v.is_empty()) {
            let mut blocks: Vec<serde_json::Value> = imgs
                .iter()
                .map(|img| match self.provider {
                    ApiProvider::Anthropic => serde_json::json!({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": &img.media_type,
                            "data": &img.data,
                        }
                    }),
                    ApiProvider::OpenAi | ApiProvider::Gemini | ApiProvider::LmStudio => {
                        serde_json::json!({
                            "type": "image_url",
                            "image_url": {
                                "url": format!("data:{};base64,{}", img.media_type, img.data),
                            }
                        })
                    }
                    ApiProvider::Ollama => serde_json::json!({
                        "type": "text",
                        "text": "[image attached]"
                    }),
                })
                .collect();
            blocks.push(serde_json::json!({ "type": "text", "text": &content }));
            serde_json::json!(blocks)
        } else {
            serde_json::json!(content)
        };

        // Add user message to history
        {
            let mut history = self
                .history
                .lock()
                .map_err(|e| format!("Lock error: {e}"))?;
            history.push(ChatMessage {
                role: "user".into(),
                content: msg_content,
            });
        }

        // Stream the response in background
        self.stream_response(event_tx.clone());

        Ok(())
    }

    fn respond_permission(&mut self, _request_id: String, _allowed: bool) -> Result<(), String> {
        // HTTP API adapters don't support permissions
        Err("Permissions not supported by API adapters".into())
    }

    fn interrupt(&mut self) -> Result<(), String> {
        // No process to interrupt — the HTTP request will finish on its own
        Ok(())
    }

    fn stop(&mut self) -> Result<(), String> {
        self.alive = false;
        if let Ok(mut h) = self.history.lock() {
            h.clear();
        }
        self.event_tx = None;
        Ok(())
    }

    fn is_alive(&self) -> bool {
        self.alive
    }

    fn provider_name(&self) -> &str {
        match self.provider {
            ApiProvider::Anthropic => "anthropic-api",
            ApiProvider::OpenAi => "openai-api",
            ApiProvider::Gemini => "gemini-api",
            ApiProvider::Ollama => "ollama",
            ApiProvider::LmStudio => "lmstudio",
        }
    }

    fn capabilities(&self) -> AdapterCapabilities {
        AdapterCapabilities {
            supports_tools: false,
            supports_permissions: false,
            supports_streaming: true,
            supports_images: matches!(
                self.provider,
                ApiProvider::Anthropic | ApiProvider::OpenAi | ApiProvider::Gemini
            ),
            supports_file_access: false,
            supports_terminal: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::SessionConfig;

    fn gemini_config() -> SessionConfig {
        SessionConfig {
            provider: "gemini-api".to_string(),
            model: "gemini-2.0-flash".to_string(),
            cwd: ".".to_string(),
            api_key: Some("test-key".to_string()),
            base_url: None,
            temperature: None,
            max_tokens: None,
            resume_session_id: None,
            session_id: None,
        }
    }

    #[test]
    fn test_gemini_provider_detected() {
        let adapter = HttpApiAdapter::new("gemini-api", &gemini_config()).unwrap();
        let caps = adapter.capabilities();
        assert!(caps.supports_streaming);
        assert!(caps.supports_images);
        assert!(!caps.supports_tools);
    }

    #[test]
    fn test_gemini_default_base_url() {
        let adapter = HttpApiAdapter::new("gemini-api", &gemini_config()).unwrap();
        assert!(adapter
            .base_url
            .contains("generativelanguage.googleapis.com"));
    }

    #[test]
    fn test_gemini_endpoint_url() {
        let adapter = HttpApiAdapter::new("gemini-api", &gemini_config()).unwrap();
        let url = adapter.endpoint_url();
        assert!(url.contains("generativelanguage.googleapis.com"));
        assert!(url.ends_with("/chat/completions"));
        assert!(!url.contains("/v1/chat/completions"));
    }

    #[test]
    fn test_gemini_provider_name() {
        let adapter = HttpApiAdapter::new("gemini-api", &gemini_config()).unwrap();
        assert_eq!(adapter.provider_name(), "gemini-api");
    }

    #[test]
    fn test_unknown_provider_returns_error() {
        let cfg = SessionConfig {
            provider: "unknown".to_string(),
            model: "m".to_string(),
            cwd: ".".to_string(),
            api_key: None,
            base_url: None,
            temperature: None,
            max_tokens: None,
            resume_session_id: None,
            session_id: None,
        };
        assert!(HttpApiAdapter::new("unknown", &cfg).is_err());
    }
}
