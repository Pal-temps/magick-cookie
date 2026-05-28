//! MCP (Model Context Protocol) client — communicates with MCP servers via JSON-RPC over stdio.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

// ─── MCP Server Configuration ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub auto_connect: bool,
}

fn default_true() -> bool {
    true
}

// ─── MCP Tool Schema ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "inputSchema")]
    pub input_schema: serde_json::Value,
}

// ─── MCP Resource ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "mimeType")]
    pub mime_type: String,
}

// ─── JSON-RPC types ───

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct JsonRpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    #[allow(dead_code)]
    id: Option<u64>,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize, Debug)]
struct JsonRpcError {
    #[allow(dead_code)]
    code: i64,
    message: String,
}

// ─── MCP Client ───

pub struct McpClient {
    process: Child,
    next_id: AtomicU64,
    stdin: Arc<Mutex<std::process::ChildStdin>>,
    stdout: Arc<Mutex<BufReader<std::process::ChildStdout>>>,
    #[allow(dead_code)]
    pub config: McpServerConfig,
    pub tools: Vec<McpTool>,
    pub resources: Vec<McpResource>,
}

impl McpClient {
    /// Spawn the MCP server process and perform initialization handshake.
    pub fn connect(config: &McpServerConfig) -> Result<Self, String> {
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args);

        for (k, v) in &config.env {
            cmd.env(k, v);
        }

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut process = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP server '{}': {e}", config.name))?;

        let stdin = process
            .stdin
            .take()
            .ok_or("Failed to open stdin for MCP server")?;
        let stdout = process
            .stdout
            .take()
            .ok_or("Failed to open stdout for MCP server")?;

        let mut client = Self {
            process,
            next_id: AtomicU64::new(1),
            stdin: Arc::new(Mutex::new(stdin)),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
            config: config.clone(),
            tools: Vec::new(),
            resources: Vec::new(),
        };

        // Initialize handshake
        client.initialize()?;

        // Discover tools
        client.tools = client.list_tools().unwrap_or_default();

        // Discover resources
        client.resources = client.list_resources().unwrap_or_default();

        Ok(client)
    }

    fn send_request(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);

        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id,
            method: method.to_string(),
            params,
        };

        let mut payload =
            serde_json::to_string(&request).map_err(|e| format!("Serialize request: {e}"))?;
        payload.push('\n');

        // Write to stdin
        {
            let mut stdin = self.stdin.lock().map_err(|e| format!("stdin lock: {e}"))?;
            stdin
                .write_all(payload.as_bytes())
                .map_err(|e| format!("Write to MCP server: {e}"))?;
            stdin.flush().map_err(|e| format!("Flush MCP stdin: {e}"))?;
        }

        // Read response (blocking read of one line)
        let mut line = String::new();
        {
            let mut stdout = self
                .stdout
                .lock()
                .map_err(|e| format!("stdout lock: {e}"))?;
            stdout
                .read_line(&mut line)
                .map_err(|e| format!("Read from MCP server: {e}"))?;
        }

        if line.trim().is_empty() {
            return Err("Empty response from MCP server".into());
        }

        let response: JsonRpcResponse =
            serde_json::from_str(line.trim()).map_err(|e| format!("Parse MCP response: {e}"))?;

        if let Some(err) = response.error {
            return Err(format!("MCP error: {}", err.message));
        }

        response
            .result
            .ok_or_else(|| "MCP response has no result".into())
    }

    fn initialize(&mut self) -> Result<(), String> {
        let params = serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "roots": { "listChanged": true }
            },
            "clientInfo": {
                "name": "Cookia",
                "version": "1.0.0"
            }
        });

        let result = self.send_request("initialize", Some(params))?;

        // Validate server capabilities
        let _server_name = result
            .get("serverInfo")
            .and_then(|s| s.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("unknown");

        // Send initialized notification (no response expected, but we send it)
        let notif = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        let mut payload = serde_json::to_string(&notif).unwrap_or_default();
        payload.push('\n');

        if let Ok(mut stdin) = self.stdin.lock() {
            let _ = stdin.write_all(payload.as_bytes());
            let _ = stdin.flush();
        }

        Ok(())
    }

    fn list_tools(&self) -> Result<Vec<McpTool>, String> {
        let result = self.send_request("tools/list", None)?;
        let tools = result
            .get("tools")
            .cloned()
            .unwrap_or(serde_json::Value::Array(vec![]));
        serde_json::from_value(tools).map_err(|e| format!("Parse tools: {e}"))
    }

    fn list_resources(&self) -> Result<Vec<McpResource>, String> {
        let result = self.send_request("resources/list", None)?;
        let resources = result
            .get("resources")
            .cloned()
            .unwrap_or(serde_json::Value::Array(vec![]));
        serde_json::from_value(resources).map_err(|e| format!("Parse resources: {e}"))
    }

    /// Execute a tool call on this MCP server.
    pub fn call_tool(&self, name: &str, arguments: serde_json::Value) -> Result<String, String> {
        let params = serde_json::json!({
            "name": name,
            "arguments": arguments,
        });

        let result = self.send_request("tools/call", Some(params))?;

        // Extract content from result
        if let Some(content) = result.get("content") {
            if let Some(arr) = content.as_array() {
                let parts: Vec<String> = arr
                    .iter()
                    .filter_map(|c| {
                        if c.get("type").and_then(|t| t.as_str()) == Some("text") {
                            c.get("text").and_then(|t| t.as_str()).map(String::from)
                        } else {
                            Some(serde_json::to_string(c).unwrap_or_default())
                        }
                    })
                    .collect();
                return Ok(parts.join("\n"));
            }
        }

        // Fallback: return raw result
        Ok(serde_json::to_string_pretty(&result).unwrap_or_default())
    }

    /// Read a resource from this MCP server.
    #[allow(dead_code)]
    pub fn read_resource(&self, uri: &str) -> Result<String, String> {
        let params = serde_json::json!({ "uri": uri });
        let result = self.send_request("resources/read", Some(params))?;

        if let Some(contents) = result.get("contents") {
            if let Some(arr) = contents.as_array() {
                let parts: Vec<String> = arr
                    .iter()
                    .filter_map(|c| c.get("text").and_then(|t| t.as_str()).map(String::from))
                    .collect();
                return Ok(parts.join("\n"));
            }
        }

        Ok(serde_json::to_string_pretty(&result).unwrap_or_default())
    }

    /// Check if the MCP server process is still running.
    #[allow(dead_code)]
    pub fn is_alive(&mut self) -> bool {
        self.process
            .try_wait()
            .map(|status| status.is_none())
            .unwrap_or(false)
    }

    /// Stop the MCP server process.
    pub fn stop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

impl Drop for McpClient {
    fn drop(&mut self) {
        self.stop();
    }
}

// ─── MCP Manager (manages multiple MCP server connections) ───

pub struct McpManager {
    clients: HashMap<String, McpClient>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
        }
    }

    /// Connect to an MCP server. Returns the list of tools it provides.
    pub fn connect_server(&mut self, config: &McpServerConfig) -> Result<Vec<McpTool>, String> {
        // Disconnect existing connection with same ID
        self.disconnect_server(&config.id);

        let client = McpClient::connect(config)?;
        let tools = client.tools.clone();
        self.clients.insert(config.id.clone(), client);
        Ok(tools)
    }

    /// Disconnect an MCP server.
    pub fn disconnect_server(&mut self, id: &str) {
        if let Some(mut client) = self.clients.remove(id) {
            client.stop();
        }
    }

    /// Get all tools from all connected servers, prefixed with server id.
    pub fn all_tools(&self) -> Vec<(String, McpTool)> {
        let mut all = Vec::new();
        for (server_id, client) in &self.clients {
            for tool in &client.tools {
                all.push((server_id.clone(), tool.clone()));
            }
        }
        all
    }

    /// Find which server provides a given tool name and call it.
    pub fn call_tool(
        &self,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<String, String> {
        // Tool names are prefixed: "server_id__tool_name"
        if let Some(sep_pos) = tool_name.find("__") {
            let server_id = &tool_name[..sep_pos];
            let actual_name = &tool_name[sep_pos + 2..];
            if let Some(client) = self.clients.get(server_id) {
                return client.call_tool(actual_name, arguments);
            }
            return Err(format!("MCP server '{server_id}' not connected"));
        }

        // Fallback: try all servers for an unprefixed tool name
        for client in self.clients.values() {
            if client.tools.iter().any(|t| t.name == tool_name) {
                return client.call_tool(tool_name, arguments);
            }
        }

        Err(format!("No MCP server provides tool '{tool_name}'"))
    }

    /// List connected server IDs.
    pub fn connected_servers(&self) -> Vec<String> {
        self.clients.keys().cloned().collect()
    }

    /// Stop all servers.
    #[allow(dead_code)]
    pub fn stop_all(&mut self) {
        let ids: Vec<String> = self.clients.keys().cloned().collect();
        for id in ids {
            self.disconnect_server(&id);
        }
    }
}

impl Default for McpManager {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Config persistence (vault-backed) ───

pub fn load_mcp_configs(vault_path: &str) -> Vec<McpServerConfig> {
    let path = std::path::PathBuf::from(vault_path).join("_mcp/servers.json");
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_mcp_configs(vault_path: &str, configs: &[McpServerConfig]) -> Result<(), String> {
    let dir = std::path::PathBuf::from(vault_path).join("_mcp");
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir _mcp: {e}"))?;
    let path = dir.join("servers.json");
    let content = serde_json::to_string_pretty(configs).map_err(|e| format!("Serialize: {e}"))?;
    std::fs::write(&path, content).map_err(|e| format!("Write: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_persistence() {
        let tmp = std::env::temp_dir().join("mc-test-mcp-config");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        let vault = tmp.to_str().unwrap();
        let configs = vec![McpServerConfig {
            id: "test-server".into(),
            name: "Test Server".into(),
            command: "node".into(),
            args: vec!["server.js".into()],
            env: HashMap::new(),
            enabled: true,
            auto_connect: false,
        }];

        save_mcp_configs(vault, &configs).unwrap();
        let loaded = load_mcp_configs(vault);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "test-server");
        assert_eq!(loaded[0].command, "node");

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
