use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};

#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, HWND_BOTTOM, HWND_NOTOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

/// Saved window state before entering desktop mode
struct SavedWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

static SAVED_STATE: Mutex<Option<SavedWindowState>> = Mutex::new(None);

#[tauri::command]
pub async fn enter_desktop_mode(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("No main window")?;

    // Save current window position and size
    let pos = window
        .outer_position()
        .map_err(|e| format!("Position error: {e}"))?;
    let size = window
        .outer_size()
        .map_err(|e| format!("Size error: {e}"))?;
    {
        let mut state = SAVED_STATE.lock().unwrap();
        *state = Some(SavedWindowState {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
        });
    }

    // Get the monitor dimensions to cover the full screen
    let monitor = window
        .current_monitor()
        .map_err(|e| format!("Monitor error: {e}"))?
        .ok_or("No monitor found")?;
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();

    // Move and resize to cover the full monitor (NOT fullscreen — preserves transparency)
    let _ = window.set_position(PhysicalPosition::new(monitor_pos.x, monitor_pos.y));
    let _ = window.set_size(PhysicalSize::new(monitor_size.width, monitor_size.height));

    // Remove min size constraint so the window can cover any monitor
    let _ = window.set_min_size(None::<PhysicalSize<u32>>);

    // Push behind everything
    let _ = window.set_always_on_bottom(true);
    let _ = window.set_skip_taskbar(true);

    // Use Windows API to push window to the very bottom of z-order
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = SetWindowPos(
                    HWND(hwnd.0),
                    HWND_BOTTOM,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
        }
    }

    let _ = app.emit("desktop-mode-changed", true);

    Ok(())
}

#[tauri::command]
pub async fn exit_desktop_mode(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("No main window")?;

    // Restore normal z-order FIRST
    let _ = window.set_always_on_bottom(false);
    let _ = window.set_skip_taskbar(false);

    // Restore min size constraint
    let _ = window.set_min_size(Some(PhysicalSize::new(900u32, 600u32)));

    // Restore saved window position and size
    let saved = {
        let mut state = SAVED_STATE.lock().unwrap();
        state.take()
    };
    if let Some(s) = saved {
        let _ = window.set_size(PhysicalSize::new(s.width, s.height));
        let _ = window.set_position(PhysicalPosition::new(s.x, s.y));
    } else {
        // Fallback to default size
        let _ = window.set_size(PhysicalSize::new(1200u32, 800u32));
    }

    // Bring to front with proper z-order
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = SetWindowPos(
                    HWND(hwnd.0),
                    HWND_NOTOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE,
                );
            }
        }
    }

    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit("desktop-mode-changed", false);

    Ok(())
}
