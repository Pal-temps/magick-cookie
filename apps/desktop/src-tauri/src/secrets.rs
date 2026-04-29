use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use keepass::db::{Entry, Group, Value};
use keepass::{Database, DatabaseKey};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use zeroize::Zeroize;

use crate::notes;

// ─── Types ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretEntry {
    pub id: String,
    pub group: String,
    pub title: String,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub url: String,
    pub notes: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecretGroup {
    pub name: String,
    pub path: String,
    pub entry_count: usize,
    pub children: Vec<SecretGroup>,
}

// ─── State ───

pub struct SecretsState {
    pub(crate) db: Option<Database>,
    master_key: Option<String>,
    vault_path: Option<PathBuf>,
}

impl SecretsState {
    pub fn new() -> Self {
        Self { db: None, master_key: None, vault_path: None }
    }
}

pub type SharedSecrets = Mutex<SecretsState>;

// ─── Helpers ───

fn local_vault_path() -> Result<PathBuf, String> {
    let local_dir = dirs::data_local_dir().ok_or("No local data dir")?;
    let local_path = local_dir.join("magick-cookie-vault");
    std::fs::create_dir_all(&local_path).map_err(|e| format!("mkdir error: {e}"))?;
    Ok(local_path.join("vault.kdbx"))
}

fn kdbx_path(state: &SecretsState) -> Result<PathBuf, String> {
    // No git vault path configured → always local (default when no git settings)
    let Some(vault) = state.vault_path.as_ref() else {
        return local_vault_path();
    };

    // User explicitly opted into local-only storage (not git-synced)
    if vault.join("_secrets").join(".local-only").exists() {
        return local_vault_path();
    }

    Ok(vault.join("_secrets").join("vault.kdbx"))
}

/// Check if vault is in local-only mode
fn is_local_mode(vault_path: &Path) -> bool {
    vault_path.join("_secrets").join(".local-only").exists()
}

/// Set local-only mode
fn set_local_mode(vault_path: &Path, local: bool) -> Result<(), String> {
    let marker = vault_path.join("_secrets").join(".local-only");
    std::fs::create_dir_all(vault_path.join("_secrets")).ok();
    if local {
        std::fs::write(&marker, "This vault stores secrets locally (not git-synced).\n")
            .map_err(|e| format!("Write error: {e}"))?;
        // Move existing kdbx from git vault to local if it exists
        let git_kdbx = vault_path.join("_secrets").join("vault.kdbx");
        if git_kdbx.exists() {
            if let Some(local_dir) = dirs::data_local_dir() {
                let local_path = local_dir.join("magick-cookie-vault");
                std::fs::create_dir_all(&local_path).ok();
                let dest = local_path.join("vault.kdbx");
                if !dest.exists() {
                    std::fs::rename(&git_kdbx, &dest)
                        .map_err(|e| format!("Move to local error: {e}"))?;
                }
            }
        }
    } else {
        if marker.exists() {
            std::fs::remove_file(&marker).ok();
        }
        // Move kdbx back to git vault
        if let Some(local_dir) = dirs::data_local_dir() {
            let local_kdbx = local_dir.join("magick-cookie-vault").join("vault.kdbx");
            let git_kdbx = vault_path.join("_secrets").join("vault.kdbx");
            if local_kdbx.exists() && !git_kdbx.exists() {
                std::fs::rename(&local_kdbx, &git_kdbx)
                    .map_err(|e| format!("Move to git error: {e}"))?;
            }
        }
    }
    Ok(())
}

fn entry_to_secret(entry: &Entry, group_path: &str, include_password: bool) -> SecretEntry {
    SecretEntry {
        id: entry.uuid.to_string(),
        group: group_path.to_string(),
        title: entry.get("Title").unwrap_or("").to_string(),
        username: entry.get("UserName").unwrap_or("").to_string(),
        password: if include_password { Some(entry.get("Password").unwrap_or("").to_string()) } else { None },
        url: entry.get("URL").unwrap_or("").to_string(),
        notes: entry.get("Notes").unwrap_or("").to_string(),
        tags: entry.tags.clone(),
    }
}

fn collect_entries(group: &Group, path: &str, include_pwd: bool, results: &mut Vec<SecretEntry>) {
    let current = if path.is_empty() { group.name.clone() } else { format!("{}/{}", path, group.name) };

    for entry in &group.entries {
        results.push(entry_to_secret(entry, &current, include_pwd));
    }
    for sub in &group.groups {
        collect_entries(sub, &current, include_pwd, results);
    }
}

fn collect_groups(group: &Group, path: &str) -> SecretGroup {
    let current = if path.is_empty() { group.name.clone() } else { format!("{}/{}", path, group.name) };
    SecretGroup {
        name: group.name.clone(),
        path: current.clone(),
        entry_count: group.entries.len(),
        children: group.groups.iter().map(|g| collect_groups(g, &current)).collect(),
    }
}

fn get_or_create_group<'a>(root: &'a mut Group, path: &str) -> &'a mut Group {
    if path.is_empty() { return root; }
    let parts: Vec<&str> = path.split('/').collect();
    let mut current = root;
    for part in parts {
        // Use group_by_path_mut helper or manual lookup
        let exists = current.groups.iter().position(|g| g.name == part);
        if let Some(idx) = exists {
            current = &mut current.groups[idx];
        } else {
            current.groups.push(Group::new(part));
            let last = current.groups.len() - 1;
            current = &mut current.groups[last];
        }
    }
    current
}

fn save_db(state: &SecretsState) -> Result<(), String> {
    let db = state.db.as_ref().ok_or("Vault not unlocked")?;
    let master = state.master_key.as_ref().ok_or("No master key")?;
    let path = kdbx_path(state)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir error: {e}"))?;
    }

    let mut file = std::fs::File::create(&path).map_err(|e| format!("Create file error: {e}"))?;
    let key = DatabaseKey::new().with_password(master);
    db.save(&mut file, key).map_err(|e| format!("Save KDBX error: {e}"))
}

fn remove_entry_recursive(group: &mut Group, id: &str) -> bool {
    let before = group.entries.len();
    group.entries.retain(|e| e.uuid.to_string() != id);
    if group.entries.len() < before { return true; }
    for sub in &mut group.groups {
        if remove_entry_recursive(sub, id) { return true; }
    }
    false
}

// ─── Tauri Commands ───

#[tauri::command]
pub fn secrets_init(
    app: AppHandle,
    state: tauri::State<'_, SharedSecrets>,
    master_password: String,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;

    // Git-backed vault path only if notes (git) is configured; otherwise fall back to local AppData.
    s.vault_path = notes::load_config_pub(&app).ok().map(|c| PathBuf::from(&c.path));
    let path = kdbx_path(&s)?;

    if path.exists() {
        let mut file = std::fs::File::open(&path).map_err(|e| format!("Open error: {e}"))?;
        let key = DatabaseKey::new().with_password(&master_password);
        let db = Database::open(&mut file, key).map_err(|e| format!("Unlock error: {e}"))?;
        s.db = Some(db);
    } else {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("mkdir error: {e}"))?;
        }
        let mut db = Database::new(Default::default());
        db.root.name = "Root".to_string();
        for name in ["App Secrets", "Passwords"] {
            db.root.groups.push(Group::new(name));
        }
        let mut file = std::fs::File::create(&path).map_err(|e| format!("Create error: {e}"))?;
        let key = DatabaseKey::new().with_password(&master_password);
        db.save(&mut file, key).map_err(|e| format!("Save error: {e}"))?;
        s.db = Some(db);
    }

    s.master_key = Some(master_password);
    Ok(())
}

#[tauri::command]
pub fn secrets_lock(state: tauri::State<'_, SharedSecrets>) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.db = None;
    // Zeroize the master key bytes before dropping to prevent memory leaks of secrets
    if let Some(ref mut key) = s.master_key {
        key.zeroize();
    }
    s.master_key = None;
    Ok(())
}

#[tauri::command]
pub fn secrets_is_unlocked(state: tauri::State<'_, SharedSecrets>) -> bool {
    state.lock().map(|s| s.db.is_some()).unwrap_or(false)
}

#[tauri::command]
pub fn secrets_is_local_mode(app: AppHandle) -> Result<bool, String> {
    // No git config → always local (default)
    match notes::load_config_pub(&app) {
        Ok(config) => Ok(is_local_mode(&PathBuf::from(&config.path))),
        Err(_) => Ok(true),
    }
}

#[tauri::command]
pub fn secrets_set_local_mode(
    app: AppHandle,
    state: tauri::State<'_, SharedSecrets>,
    local: bool,
) -> Result<(), String> {
    let config = notes::load_config_pub(&app)
        .map_err(|_| "Configurez d'abord un dépôt Git dans les réglages pour activer la synchronisation cloud.".to_string())?;
    let vault_path = PathBuf::from(&config.path);

    // Must be locked to change mode (avoids corruption)
    let s = state.lock().map_err(|e| e.to_string())?;
    if s.db.is_some() {
        return Err("Verrouillez le coffre-fort avant de changer le mode de stockage".into());
    }
    drop(s);

    set_local_mode(&vault_path, local)?;
    Ok(())
}

#[tauri::command]
pub fn secrets_list(state: tauri::State<'_, SharedSecrets>, group: Option<String>) -> Result<Vec<SecretEntry>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    let mut entries = Vec::new();
    collect_entries(&db.root, "", false, &mut entries);
    if let Some(g) = group { entries.retain(|e| e.group.contains(&g)); }
    Ok(entries)
}

#[tauri::command]
pub fn secrets_get(state: tauri::State<'_, SharedSecrets>, id: String) -> Result<SecretEntry, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    let mut entries = Vec::new();
    collect_entries(&db.root, "", true, &mut entries);
    entries.into_iter().find(|e| e.id == id).ok_or_else(|| format!("Entry not found: {id}"))
}

#[tauri::command]
pub fn secrets_set(state: tauri::State<'_, SharedSecrets>, entry: SecretEntry) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_mut().ok_or("Vault not unlocked")?;

    // Remove old entry if updating
    if !entry.id.is_empty() {
        remove_entry_recursive(&mut db.root, &entry.id);
    }

    let group = get_or_create_group(&mut db.root, &entry.group);

    let mut kp_entry = Entry::new();
    kp_entry.fields.insert("Title".into(), Value::Unprotected(entry.title));
    kp_entry.fields.insert("UserName".into(), Value::Unprotected(entry.username));
    if let Some(password) = entry.password {
        kp_entry.fields.insert("Password".into(), Value::Protected(password.as_bytes().into()));
    }
    kp_entry.fields.insert("URL".into(), Value::Unprotected(entry.url));
    kp_entry.fields.insert("Notes".into(), Value::Unprotected(entry.notes));
    kp_entry.tags = entry.tags;
    group.entries.push(kp_entry);

    save_db(&s)
}

#[tauri::command]
pub fn secrets_delete(state: tauri::State<'_, SharedSecrets>, id: String) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_mut().ok_or("Vault not unlocked")?;
    if !remove_entry_recursive(&mut db.root, &id) {
        return Err(format!("Entry not found: {id}"));
    }
    save_db(&s)
}

#[tauri::command]
pub fn secrets_search(state: tauri::State<'_, SharedSecrets>, query: String) -> Result<Vec<SecretEntry>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    let mut entries = Vec::new();
    collect_entries(&db.root, "", false, &mut entries);
    let q = query.to_lowercase();
    entries.retain(|e| e.title.to_lowercase().contains(&q) || e.username.to_lowercase().contains(&q) || e.url.to_lowercase().contains(&q));
    Ok(entries)
}

#[tauri::command]
pub fn secrets_groups(state: tauri::State<'_, SharedSecrets>) -> Result<SecretGroup, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    Ok(collect_groups(&db.root, ""))
}

#[tauri::command]
pub fn secrets_delete_group(state: tauri::State<'_, SharedSecrets>, path: String) -> Result<(), String> {
    // Prevent deleting protected groups
    let protected = ["App Secrets", "Passwords"];
    if protected.iter().any(|p| path == *p || path.starts_with(&format!("{p}/"))) {
        return Err("Ce groupe est protégé et ne peut pas être supprimé".into());
    }

    let mut s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_mut().ok_or("Vault not unlocked")?;

    // Find and remove the group
    let parts: Vec<&str> = path.split('/').collect();
    if parts.is_empty() {
        return Err("Chemin de groupe invalide".into());
    }

    let group_name = parts.last().unwrap().to_string();
    let parent_path = parts[..parts.len() - 1].join("/");

    let parent = if parent_path.is_empty() {
        &mut db.root
    } else {
        get_or_create_group(&mut db.root, &parent_path)
    };

    let before = parent.groups.len();
    parent.groups.retain(|g| g.name != group_name);
    if parent.groups.len() == before {
        return Err(format!("Groupe '{}' introuvable", group_name));
    }

    save_db(&s)?;
    Ok(())
}

#[tauri::command]
pub fn secrets_get_app_secret(state: tauri::State<'_, SharedSecrets>, key: String) -> Result<String, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    let mut entries = Vec::new();
    collect_entries(&db.root, "", true, &mut entries);
    entries.into_iter()
        .find(|e| e.group.contains("App Secrets") && e.title == key)
        .and_then(|e| e.password)
        .ok_or_else(|| format!("App secret not found: {key}"))
}

#[tauri::command]
pub fn secrets_set_app_secret(state: tauri::State<'_, SharedSecrets>, key: String, value: String) -> Result<(), String> {
    // Remove existing entry with same title in App Secrets
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        let db = s.db.as_mut().ok_or("Vault not unlocked")?;
        let group = get_or_create_group(&mut db.root, "App Secrets");
        group.entries.retain(|e| e.get("Title") != Some(&key));
    }

    secrets_set(state, SecretEntry {
        id: String::new(),
        group: "App Secrets".to_string(),
        title: key,
        username: String::new(),
        password: Some(value),
        url: String::new(),
        notes: String::new(),
        tags: vec![],
    })
}

/// Remove an app secret by its key (title) from the "App Secrets" group.
/// No-op (Ok) if the vault is locked or the key is not found.
pub(crate) fn remove_app_secret(state: &SharedSecrets, key: &str) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    let Some(db) = s.db.as_mut() else { return Ok(()); };
    let key_owned = key.to_string();
    if let Some(group) = db.root.groups.iter_mut().find(|g| g.name == "App Secrets") {
        group.entries.retain(|e| e.get("Title") != Some(&key_owned));
    }
    save_db(&s)
}

// ═══════════════════════════════════════════
// SSH KEY GENERATOR
// ═══════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct SshKeyResult {
    pub name: String,
    pub public_key: String,
    pub fingerprint: String,
}

/// Generate an ED25519 SSH key pair, store the private key in the KDBX vault,
/// and return the public key. The key is generated in a temp file then imported.
#[tauri::command]
pub fn secrets_generate_ssh_key(
    state: tauri::State<'_, SharedSecrets>,
    name: String,
    comment: Option<String>,
) -> Result<SshKeyResult, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    if s.db.is_none() { return Err("Vault not unlocked".into()); }
    drop(s); // Release lock before running ssh-keygen

    let comment = comment.unwrap_or_else(|| format!("magick-cookie-{name}"));

    // Generate in a temp directory
    let tmp_dir = std::env::temp_dir().join(format!("mc-ssh-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("mkdir error: {e}"))?;
    let key_path = tmp_dir.join("id_ed25519");

    let output = Command::new("ssh-keygen")
        .args([
            "-t", "ed25519",
            "-f", &key_path.to_string_lossy(),
            "-N", "",
            "-C", &comment,
        ])
        .output()
        .map_err(|e| format!("ssh-keygen failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_dir_all(&tmp_dir);
        return Err(format!("ssh-keygen error: {stderr}"));
    }

    // Read private key
    let private_key = std::fs::read_to_string(&key_path)
        .map_err(|e| format!("Read private key error: {e}"))?;

    // Read public key
    let pubkey_path = tmp_dir.join("id_ed25519.pub");
    let public_key = std::fs::read_to_string(&pubkey_path)
        .map_err(|e| format!("Read public key error: {e}"))?
        .trim()
        .to_string();

    // Get fingerprint
    let fp_output = Command::new("ssh-keygen")
        .args(["-l", "-f", &key_path.to_string_lossy()])
        .output()
        .ok();
    let fingerprint = fp_output
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string();

    // Clean up temp files
    let _ = std::fs::remove_dir_all(&tmp_dir);

    // Store private key in KDBX
    let mut s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_mut().ok_or("Vault not unlocked")?;
    let group = get_or_create_group(&mut db.root, "App Secrets/SSH Keys");

    let mut entry = Entry::new();
    entry.fields.insert("Title".into(), Value::Unprotected(name.clone()));
    entry.fields.insert("UserName".into(), Value::Unprotected(public_key.clone()));
    entry.fields.insert("Password".into(), Value::Protected(private_key.as_bytes().into()));
    entry.fields.insert("Notes".into(), Value::Unprotected(format!("Fingerprint: {fingerprint}\nComment: {comment}")));
    entry.tags = vec!["ssh-key".into()];
    group.entries.push(entry);

    save_db(&s)?;

    Ok(SshKeyResult {
        name,
        public_key,
        fingerprint,
    })
}

/// Export the entire KDBX vault to a chosen path
#[tauri::command]
pub fn secrets_export_kdbx(
    state: tauri::State<'_, SharedSecrets>,
    output_path: String,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    let master = s.master_key.as_ref().ok_or("No master key")?;

    let path = PathBuf::from(&output_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir error: {e}"))?;
    }
    let mut file = std::fs::File::create(&path).map_err(|e| format!("Create error: {e}"))?;
    let key = DatabaseKey::new().with_password(master);
    db.save(&mut file, key).map_err(|e| format!("Export KDBX error: {e}"))
}

/// Import entries from an external KDBX file into the current vault
#[tauri::command]
pub fn secrets_import_kdbx(
    state: tauri::State<'_, SharedSecrets>,
    input_path: String,
    import_password: String,
) -> Result<usize, String> {
    let path = PathBuf::from(&input_path);
    if !path.exists() {
        return Err("File not found".into());
    }

    let mut file = std::fs::File::open(&path).map_err(|e| format!("Open error: {e}"))?;
    let key = DatabaseKey::new().with_password(&import_password);
    let import_db = Database::open(&mut file, key).map_err(|e| format!("Unlock import file error: {e}"))?;

    let mut s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_mut().ok_or("Vault not unlocked")?;

    let mut count = 0;
    fn import_entries(src: &Group, dst: &mut Group, path: &str, count: &mut usize) {
        for entry in &src.entries {
            let mut cloned = Entry::new();
            for (k, v) in &entry.fields {
                cloned.fields.insert(k.clone(), v.clone());
            }
            cloned.tags = entry.tags.clone();
            dst.entries.push(cloned);
            *count += 1;
        }
        for sub in &src.groups {
            let sub_path = if path.is_empty() { sub.name.clone() } else { format!("{}/{}", path, sub.name) };
            let exists = dst.groups.iter().position(|g| g.name == sub.name);
            let idx = if let Some(idx) = exists {
                idx
            } else {
                dst.groups.push(Group::new(&sub.name));
                dst.groups.len() - 1
            };
            import_entries(sub, &mut dst.groups[idx], &sub_path, count);
        }
    }

    import_entries(&import_db.root, &mut db.root, "", &mut count);
    save_db(&s)?;

    Ok(count)
}

/// List all SSH keys stored in the vault (public keys only)
#[tauri::command]
pub fn secrets_list_ssh_keys(
    state: tauri::State<'_, SharedSecrets>,
) -> Result<Vec<SshKeyResult>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;

    let mut keys = Vec::new();
    if let Some(group) = db.root.group_by_path(&["App Secrets", "SSH Keys"]) {
        for entry in &group.entries {
            keys.push(SshKeyResult {
                name: entry.get("Title").unwrap_or("").to_string(),
                public_key: entry.get("UserName").unwrap_or("").to_string(),
                fingerprint: entry.get("Notes").unwrap_or("").lines().next().unwrap_or("").replace("Fingerprint: ", ""),
            });
        }
    }

    Ok(keys)
}

/// Get the private key for a named SSH key (for SSH connections)
#[tauri::command]
pub fn secrets_get_ssh_private_key(
    state: tauri::State<'_, SharedSecrets>,
    name: String,
) -> Result<String, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;

    if let Some(group) = db.root.group_by_path(&["App Secrets", "SSH Keys"]) {
        for entry in &group.entries {
            if entry.get("Title") == Some(&name) {
                return Ok(entry.get("Password").unwrap_or("").to_string());
            }
        }
    }

    Err(format!("SSH key not found: {name}"))
}

/// Export an SSH key to a file on disk (for use with ssh-agent, etc.)
#[tauri::command]
pub fn secrets_export_ssh_key(
    state: tauri::State<'_, SharedSecrets>,
    name: String,
    output_path: String,
) -> Result<String, String> {
    let private_key = secrets_get_ssh_private_key(state.clone(), name.clone())?;

    // Resolve ~ to home directory
    let resolved = if output_path.starts_with("~/") {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        output_path.replacen("~", &home, 1)
    } else {
        output_path.clone()
    };
    let path = PathBuf::from(&resolved);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir error: {e}"))?;
    }

    std::fs::write(&path, &private_key).map_err(|e| format!("Write error: {e}"))?;

    // Set permissions to 600 on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("chmod error: {e}"))?;
    }

    // Also write the public key
    let s = state.lock().map_err(|e| e.to_string())?;
    let db = s.db.as_ref().ok_or("Vault not unlocked")?;
    if let Some(group) = db.root.group_by_path(&["App Secrets", "SSH Keys"]) {
        if let Some(entry) = group.entries.iter().find(|e| e.get("Title") == Some(&name)) {
            let pubkey = entry.get("UserName").unwrap_or("");
            let pub_path = format!("{}.pub", resolved);
            let _ = std::fs::write(&pub_path, pubkey);
        }
    }

    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_starts_locked() {
        let state = SecretsState::new();
        assert!(state.db.is_none(), "db should be None on creation");
        assert!(state.master_key.is_none(), "master_key should be None on creation");
        assert!(state.vault_path.is_none(), "vault_path should be None on creation");
    }

    #[test]
    fn test_vault_lock_clears_state() {
        // Simulate an "unlocked" state by setting fields directly
        let state = Mutex::new(SecretsState {
            db: Some(Database::new(Default::default())),
            master_key: Some("test-password".to_string()),
            vault_path: Some(PathBuf::from("/tmp/test-vault")),
        });

        // Verify it's "unlocked"
        {
            let s = state.lock().unwrap();
            assert!(s.db.is_some());
            assert!(s.master_key.is_some());
        }

        // Simulate lock: same logic as secrets_lock command (zeroize before drop)
        {
            let mut s = state.lock().unwrap();
            s.db = None;
            if let Some(ref mut key) = s.master_key {
                key.zeroize();
            }
            s.master_key = None;
        }

        // Verify locked state
        {
            let s = state.lock().unwrap();
            assert!(s.db.is_none(), "db should be None after lock");
            assert!(s.master_key.is_none(), "master_key should be None after lock");
            // vault_path is intentionally preserved across lock/unlock
            assert!(s.vault_path.is_some(), "vault_path should be preserved after lock");
        }
    }

    #[test]
    fn test_vault_multiple_lock_unlock_cycles() {
        let state = Mutex::new(SecretsState::new());

        for i in 0..5 {
            // Simulate unlock
            {
                let mut s = state.lock().unwrap();
                s.db = Some(Database::new(Default::default()));
                s.master_key = Some(format!("password-{i}"));
            }
            {
                let s = state.lock().unwrap();
                assert!(s.db.is_some(), "db should be Some after unlock cycle {i}");
                assert!(s.master_key.is_some(), "master_key should be Some after unlock cycle {i}");
            }

            // Simulate lock (zeroize before drop)
            {
                let mut s = state.lock().unwrap();
                s.db = None;
                if let Some(ref mut key) = s.master_key {
                    key.zeroize();
                }
                s.master_key = None;
            }
            {
                let s = state.lock().unwrap();
                assert!(s.db.is_none(), "db should be None after lock cycle {i}");
                assert!(s.master_key.is_none(), "master_key should be None after lock cycle {i}");
            }
        }
    }

    #[test]
    fn test_shared_secrets_type_alias() {
        // Verify SharedSecrets (Mutex<SecretsState>) works correctly
        let shared: SharedSecrets = Mutex::new(SecretsState::new());
        let s = shared.lock().unwrap();
        assert!(s.db.is_none());
        assert!(s.master_key.is_none());
    }
}
