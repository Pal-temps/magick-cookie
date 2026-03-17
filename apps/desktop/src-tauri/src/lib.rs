mod desktop_mode;
mod notes;
mod whisper;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
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
                    // Restore window on single-click or double-click on tray icon
                    match event {
                        tauri::tray::TrayIconEvent::Click { .. }
                        | tauri::tray::TrayIconEvent::DoubleClick { .. } => {
                            restore_main_window(tray.app_handle());
                        }
                        _ => {}
                    }
                })
                .build(app)?;

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
            notes::notes_ssh_status,
            notes::notes_ssh_generate,
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
