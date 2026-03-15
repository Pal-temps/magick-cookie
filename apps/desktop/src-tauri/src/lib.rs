mod desktop_mode;
mod notes;
mod whisper;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

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
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
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
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
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
            // Minimize to tray instead of quitting when window is closed
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
