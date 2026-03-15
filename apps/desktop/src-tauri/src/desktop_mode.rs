use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, HWND_BOTTOM, HWND_NOTOPMOST, SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE,
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

#[tauri::command]
pub async fn enter_desktop_mode(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("No main window")?;

    // Save current window state before switching
    let _ = window.set_decorations(false);
    let _ = window.set_fullscreen(true);
    let _ = window.set_always_on_bottom(true);
    let _ = window.set_skip_taskbar(true);

    // Use Windows API to push window behind everything
    #[cfg(target_os = "windows")]
    {
        let hwnd = window.hwnd().map_err(|e| format!("HWND error: {e}"))?;
        unsafe {
            let _ = SetWindowPos(
                HWND(hwnd.0),
                HWND_BOTTOM,
                0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    }

    // Emit event to frontend
    let _ = app.emit("desktop-mode-changed", true);

    Ok(())
}

#[tauri::command]
pub async fn exit_desktop_mode(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("No main window")?;

    let _ = window.set_always_on_bottom(false);
    let _ = window.set_skip_taskbar(false);
    let _ = window.set_fullscreen(false);
    let _ = window.set_decorations(true);

    // Restore normal z-order
    #[cfg(target_os = "windows")]
    {
        let hwnd = window.hwnd().map_err(|e| format!("HWND error: {e}"))?;
        unsafe {
            let _ = SetWindowPos(
                HWND(hwnd.0),
                HWND_NOTOPMOST,
                0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
    }

    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit("desktop-mode-changed", false);

    Ok(())
}
