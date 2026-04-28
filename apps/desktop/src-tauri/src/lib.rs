mod ai;
mod browser;
mod desktop_mode;
mod devops;
mod fs;
mod git;
mod notes;
mod pty;
mod remote_control;
mod screenshot;
mod secrets;
mod watcher;
mod whisper;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

/// Global keyboard shortcuts — single source of truth.
/// Each entry: (modifiers, key code, action name emitted via "global-shortcut" event).
const GLOBAL_SHORTCUTS: &[(Modifiers, Code, &str)] = &[
    (Modifiers::SHIFT.union(Modifiers::SUPER), Code::KeyN, "capture"),
    (Modifiers::SHIFT.union(Modifiers::SUPER), Code::KeyT, "timer"),
    (Modifiers::SHIFT.union(Modifiers::SUPER), Code::KeyB, "brief"),
    (Modifiers::SHIFT.union(Modifiers::SUPER), Code::KeyD, "desktop"),
];

/// Open a detached window (terminal or AI session).
#[tauri::command]
async fn open_detached_window(
    app: tauri::AppHandle,
    label: String,
    title: String,
    route: String,
) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    // If window already exists, focus it
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let url = format!("index.html#{}", route);
    WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(800.0, 600.0)
        .min_inner_size(400.0, 300.0)
        .build()
        .map_err(|e| format!("Failed to create window: {e}"))?;

    Ok(())
}

/// Restore the main window: exit desktop mode, show, and focus.
fn restore_main_window(app: &tauri::AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // Exit desktop mode (restores size, z-order, etc.)
        let _ = desktop_mode::exit_desktop_mode(app.clone()).await;
    });
}

/// Send window to desktop mode (Rainmeter-style background widgets).
fn send_to_desktop(app: &tauri::AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = desktop_mode::enter_desktop_mode(app).await;
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let session_manager: ai::session_manager::SharedSessionManager =
        std::sync::Arc::new(std::sync::Mutex::new(ai::session_manager::SessionManager::new()));
    let mcp_manager: ai::session_manager::SharedMcpManager =
        std::sync::Arc::new(std::sync::Mutex::new(ai::mcp_client::McpManager::new()));
    let pty_store: std::sync::Arc<pty::PtyStore> = pty::new_pty_store();
    let watcher_state: watcher::SharedWatcher = watcher::new_shared_watcher();
    let secrets_state: secrets::SharedSecrets = std::sync::Mutex::new(secrets::SecretsState::new());
    let browser_store: std::sync::Arc<browser::BrowserStore> =
        std::sync::Arc::new(browser::BrowserStore::new());
    let cli_manager: devops::SharedBinaryManager = devops::new_state();

    tauri::Builder::default()
        .manage(session_manager)
        .manage(mcp_manager)
        .manage(pty_store)
        .manage(watcher_state)
        .manage(secrets_state)
        .manage(browser_store)
        .manage(cli_manager)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        for &(mods, code, action) in GLOBAL_SHORTCUTS {
                            if shortcut == &Shortcut::new(Some(mods), code) {
                                let _ = app.emit("global-shortcut", action);
                                return;
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Set window icon from file (for taskbar/process list in dev + prod)
            if let Some(window) = app.get_webview_window("main") {
                let icon_path = app
                    .path()
                    .resolve("icons/icon.png", tauri::path::BaseDirectory::Resource)
                    .unwrap_or_default();
                if icon_path.exists() {
                    if let Ok(bytes) = std::fs::read(&icon_path) {
                        let icon = tauri::image::Image::from_bytes(&bytes).unwrap();
                        let _ = window.set_icon(icon);
                    }
                }
            }

            // Build tray menu
            let show = MenuItem::with_id(app, "show", "Ouvrir Magick Cookie", true, None::<&str>)?;
            let desktop = MenuItem::with_id(app, "desktop", "Mode Bureau", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &desktop, &quit])?;

            // Create system tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Magick Cookie")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        restore_main_window(app);
                    }
                    "desktop" => {
                        let _ = app.emit("toggle-desktop-mode", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click or double-click → restore window
                    // Right-click is handled by the menu automatically
                    match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left, ..
                        }
                        | tauri::tray::TrayIconEvent::DoubleClick {
                            button: tauri::tray::MouseButton::Left, ..
                        } => {
                            restore_main_window(tray.app_handle());
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Register global shortcuts (ignore "already registered" — may be held by a prior instance)
            for &(mods, code, _) in GLOBAL_SHORTCUTS {
                let shortcut = Shortcut::new(Some(mods), code);
                if !app.global_shortcut().is_registered(shortcut) {
                    let _ = app.global_shortcut().register(shortcut);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            whisper::check_whisper_model,
            whisper::download_whisper_model,
            whisper::transcribe_audio,
            desktop_mode::enter_desktop_mode,
            desktop_mode::exit_desktop_mode,
            notes::notes_get_config,
            notes::notes_set_config,
            notes::notes_list,
            notes::notes_list_drawings,
            notes::notes_list_folders,
            notes::notes_create_folder,
            notes::notes_rename,
            notes::notes_read,
            notes::notes_save,
            notes::notes_delete,
            notes::notes_delete_folder,
            notes::notes_git_status,
            notes::notes_git_pull,
            notes::notes_git_push,
            // notes_ssh_status and notes_ssh_generate removed — SSH keys are now in the KDBX vault
            notes::vault_ensure_structure,
            notes::vault_read_json,
            notes::vault_write_json,
            notes::vault_list_section,
            notes::vault_delete_file,
            fs::fs_list_dir,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_delete,
            fs::fs_create_dir,
            fs::fs_rename,
            fs::fs_scan_projects,
            git::git_is_repo,
            git::git_status,
            git::git_diff,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_log,
            git::git_discard,
            git::git_branches,
            git::git_checkout,
            git::git_pull,
            git::git_push,
            ai::session_manager::ai_list_providers,
            ai::session_manager::ai_get_capabilities,
            ai::session_manager::ai_start_session,
            ai::session_manager::ai_send_message,
            ai::session_manager::ai_respond_permission,
            ai::session_manager::ai_interrupt,
            ai::session_manager::ai_stop_session,
            ai::session_manager::ai_list_sessions,
            ai::session_manager::ai_list_past_sessions,
            ai::session_manager::ai_read_past_session,
            ai::session_manager::ai_update_session_label,
            ai::session_manager::mcp_list_servers,
            ai::session_manager::mcp_add_server,
            ai::session_manager::mcp_remove_server,
            ai::session_manager::mcp_connect_server,
            ai::session_manager::mcp_disconnect_server,
            ai::session_manager::mcp_list_tools,
            ai::session_manager::mcp_call_tool,
            ai::session_manager::mcp_get_status,
            ai::session_manager::mcp_set_auto_connect,
            ai::session_manager::mcp_auto_connect_all,
            ai::hook_runner::ai_run_hook,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            watcher::fs_watch_start,
            watcher::fs_watch_stop,
            secrets::secrets_init,
            secrets::secrets_lock,
            secrets::secrets_is_unlocked,
            secrets::secrets_is_local_mode,
            secrets::secrets_set_local_mode,
            secrets::secrets_delete_group,
            secrets::secrets_list,
            secrets::secrets_get,
            secrets::secrets_set,
            secrets::secrets_delete,
            secrets::secrets_search,
            secrets::secrets_groups,
            secrets::secrets_get_app_secret,
            secrets::secrets_set_app_secret,
            secrets::secrets_generate_ssh_key,
            secrets::secrets_list_ssh_keys,
            secrets::secrets_get_ssh_private_key,
            secrets::secrets_export_ssh_key,
            secrets::secrets_export_kdbx,
            secrets::secrets_import_kdbx,
            screenshot::capture_app_screenshot,
            screenshot::capture_app_region,
            screenshot::capture_screen_screenshot,
            screenshot::capture_browser_screenshot,
            browser::browser_create,
            browser::browser_destroy,
            browser::browser_navigate,
            browser::browser_go_back,
            browser::browser_go_forward,
            browser::browser_reload,
            browser::browser_set_visible,
            browser::browser_set_bounds,
            browser::browser_open_devtools,
            browser::browser_get_url,
            browser::browser_eval,
            browser::browser_list,
            browser::browser_pop_out,
            devops::commands::cli_list_available,
            devops::commands::cli_list_installed,
            devops::commands::cli_install,
            devops::commands::cli_uninstall,
            devops::commands::cli_resolve,
            remote_control::ai_start_remote_session,
            remote_control::ai_stop_remote_session,
            remote_control::ai_get_remote_session,
            open_detached_window,
        ])
        .on_window_event(|window, event| {
            // X button → enter desktop mode (Rainmeter-style background widgets)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                send_to_desktop(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn no_duplicate_global_shortcuts() {
        let mut seen = HashSet::new();
        for &(mods, code, action) in GLOBAL_SHORTCUTS {
            let key = (mods, code);
            assert!(
                seen.insert(key),
                "Duplicate shortcut for action '{action}': {mods:?} + {code:?}"
            );
        }
    }

    #[test]
    fn no_duplicate_shortcut_actions() {
        let mut seen = HashSet::new();
        for &(_, _, action) in GLOBAL_SHORTCUTS {
            assert!(
                seen.insert(action),
                "Duplicate action name in GLOBAL_SHORTCUTS: '{action}'"
            );
        }
    }
}
