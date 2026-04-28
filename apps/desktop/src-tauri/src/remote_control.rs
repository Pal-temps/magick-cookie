use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

// ─── Remote session state ───

#[derive(Debug, Clone, serde::Serialize)]
pub struct RemoteSession {
    pub token: String,
    pub port: u16,
    pub created_at_secs: u64,
    pub ttl_secs: u64,
}

static REMOTE_SESSIONS: Mutex<Option<HashMap<String, RemoteSession>>> = Mutex::new(None);

fn sessions() -> std::sync::MutexGuard<'static, Option<HashMap<String, RemoteSession>>> {
    REMOTE_SESSIONS.lock().unwrap()
}

fn with_sessions<R>(f: impl FnOnce(&mut HashMap<String, RemoteSession>) -> R) -> R {
    let mut guard = sessions();
    let map = guard.get_or_insert_with(HashMap::new);
    f(map)
}

// ─── Pure functions ───

pub fn generate_token() -> String {
    Uuid::new_v4().to_string()
}

/// Returns true if `seconds_elapsed` exceeds `ttl_secs`.
pub fn is_token_expired_at(seconds_elapsed: u64, ttl_secs: u64) -> bool {
    seconds_elapsed > ttl_secs
}

pub fn build_relay_url(token: &str, vps_host: &str, port: u16) -> String {
    let base = vps_host.trim_end_matches('/');
    format!("{}/m?t={}&p={}", base, token, port)
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ─── Tauri commands ───

#[tauri::command]
pub async fn ai_start_remote_session(
    vps_host: String,
    ttl_minutes: Option<u64>,
) -> Result<serde_json::Value, String> {
    let token = generate_token();
    let port: u16 = 0; // v1 fallback: no local WS server, port is informational
    let ttl_secs = ttl_minutes.unwrap_or(30) * 60;
    let created_at_secs = now_secs();

    let session = RemoteSession {
        token: token.clone(),
        port,
        created_at_secs,
        ttl_secs,
    };

    with_sessions(|map| map.insert(token.clone(), session));

    let url = build_relay_url(&token, &vps_host, port);
    Ok(serde_json::json!({
        "token": token,
        "relayUrl": url,
        "ttlSeconds": ttl_secs,
        "expiresAt": created_at_secs + ttl_secs,
    }))
}

#[tauri::command]
pub async fn ai_stop_remote_session(token: String) -> Result<(), String> {
    with_sessions(|map| map.remove(&token));
    Ok(())
}

#[tauri::command]
pub async fn ai_get_remote_session(token: String) -> Result<Option<RemoteSession>, String> {
    let result = with_sessions(|map| {
        map.get(&token).cloned().and_then(|s| {
            let elapsed = now_secs().saturating_sub(s.created_at_secs);
            if is_token_expired_at(elapsed, s.ttl_secs) {
                map.remove(&token);
                None
            } else {
                Some(s)
            }
        })
    });
    Ok(result)
}

// ─── Tests ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_valid_uuid() {
        let token = generate_token();
        assert_eq!(token.len(), 36);
        assert_eq!(token.chars().filter(|c| *c == '-').count(), 4);
    }

    #[test]
    fn two_tokens_are_different() {
        let t1 = generate_token();
        let t2 = generate_token();
        assert_ne!(t1, t2);
    }

    #[test]
    fn not_expired_at_zero_elapsed() {
        assert!(!is_token_expired_at(0, 30 * 60));
    }

    #[test]
    fn not_expired_just_before_ttl() {
        assert!(!is_token_expired_at(30 * 60, 30 * 60));
    }

    #[test]
    fn expired_after_ttl() {
        assert!(is_token_expired_at(30 * 60 + 1, 30 * 60));
    }

    #[test]
    fn relay_url_contains_token() {
        let url = build_relay_url("abc123", "https://vps.example.com", 8765);
        assert!(url.contains("abc123"));
    }

    #[test]
    fn relay_url_contains_host() {
        let url = build_relay_url("abc123", "https://vps.example.com", 8765);
        assert!(url.contains("vps.example.com"));
    }

    #[test]
    fn relay_url_contains_port() {
        let url = build_relay_url("abc123", "https://vps.example.com", 8765);
        assert!(url.contains("8765"));
    }

    #[test]
    fn relay_url_is_https() {
        let url = build_relay_url("tok", "https://vps.example.com", 9000);
        assert!(url.starts_with("https://"));
    }
}
