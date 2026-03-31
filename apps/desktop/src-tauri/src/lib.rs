mod ai;
mod desktop_mode;
mod fs;
mod git;
mod notes;
mod pty;
mod secrets;
mod watcher;
mod whisper;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

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
    let pty_store: std::sync::Arc<pty::PtyStore> = pty::new_pty_store();
    let watcher_state: watcher::SharedWatcher = watcher::new_shared_watcher();
    let secrets_state: secrets::SharedSecrets = std::sync::Mutex::new(secrets::SecretsState::new());

    tauri::Builder::default()
        .manage(session_manager)
        .manage(pty_store)
        .manage(watcher_state)
        .manage(secrets_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let capture = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyN);
                        let timer = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyT);
                        let brief = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyB);
                        let desktop = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyD);

                        let action = if shortcut == &capture {
                            "capture"
                        } else if shortcut == &timer {
                            "timer"
                        } else if shortcut == &brief {
                            "brief"
                        } else if shortcut == &desktop {
                            "desktop"
                        } else {
                            return;
                        };

                        let _ = app.emit("global-shortcut", action);
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
            let show = MenuItem::with_id(app, "show", "Ouvrir do-it-now", true, None::<&str>)?;
            let desktop = MenuItem::with_id(app, "desktop", "Mode Bureau", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &desktop, &quit])?;

            // Create system tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("do-it-now")
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

            // Register global shortcuts (ignore errors if already taken by another app)
            let shortcuts = [
                Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyN),
                Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyT),
                Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyB),
                Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyD),
            ];
            for shortcut in shortcuts {
                if let Err(e) = app.global_shortcut().register(shortcut) {
                    eprintln!("Warning: could not register shortcut {:?}: {}", shortcut, e);
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
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            watcher::fs_watch_start,
            watcher::fs_watch_stop,
            secrets::secrets_init,
            secrets::secrets_lock,
            secrets::secrets_is_unlocked,
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
