use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, WebviewBuilder, WebviewUrl};

// ─── State ───

pub struct BrowserInstance {
    pub label: String,
    pub url: String,
}

pub struct BrowserStore {
    pub instances: Mutex<HashMap<String, BrowserInstance>>,
}

impl BrowserStore {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
        }
    }
}

// ─── Commands ───

/// Create a hidden child webview for AI-controlled browsing.
/// The webview is created off-screen; use browser_show to pop it out.
#[tauri::command]
pub async fn browser_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
    url: String,
) -> Result<(), String> {
    let label = format!("browser-{id}");

    // If already exists, just navigate
    if let Some(wv) = app.get_webview(&label) {
        let parsed: url::Url = url.parse().map_err(|e| format!("Invalid URL: {e}"))?;
        wv.navigate(parsed).map_err(|e| format!("navigate failed: {e}"))?;
        state.instances.lock().unwrap().get_mut(&id).map(|i| i.url = url);
        return Ok(());
    }

    let window = app
        .get_window("main")
        .ok_or("Main window not found")?;

    // Create webview with about:blank, then navigate to the actual URL.
    // This avoids Tauri's WebviewUrl::External issues with child webviews.
    let pos = tauri::Position::Logical(tauri::LogicalPosition::new(0.0, 0.0));
    let size = tauri::Size::Logical(tauri::LogicalSize::new(1.0, 1.0));
    let builder = WebviewBuilder::new(&label, WebviewUrl::External("about:blank".parse().unwrap()));
    let webview = window
        .add_child(builder, pos, size)
        .map_err(|e| format!("Failed to create webview: {e}"))?;

    // Hide immediately — this is an AI-controlled background browser
    webview.hide().map_err(|e| format!("hide failed: {e}"))?;

    // Navigate to the actual URL
    let parsed: url::Url = url.parse().map_err(|e| format!("Invalid URL: {e}"))?;
    webview.navigate(parsed).map_err(|e| format!("navigate failed: {e}"))?;

    state
        .instances
        .lock()
        .unwrap()
        .insert(id.clone(), BrowserInstance { label, url });

    Ok(())
}

/// Destroy a browser webview.
#[tauri::command]
pub async fn browser_destroy(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<(), String> {
    let label = {
        let mut instances = state.instances.lock().unwrap();
        let inst = instances.remove(&id).ok_or("Browser not found")?;
        inst.label
    };
    if let Some(wv) = app.get_webview(&label) {
        wv.close().map_err(|e| format!("close failed: {e}"))?;
    }
    Ok(())
}

/// Navigate a browser webview to a URL.
#[tauri::command]
pub async fn browser_navigate(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
    url: String,
) -> Result<(), String> {
    let label = {
        let mut instances = state.instances.lock().unwrap();
        let inst = instances.get_mut(&id).ok_or("Browser not found")?;
        inst.url = url.clone();
        inst.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    let parsed: url::Url = url.parse().map_err(|e| format!("Invalid URL: {e}"))?;
    wv.navigate(parsed).map_err(|e| format!("navigate failed: {e}"))?;
    Ok(())
}

/// Navigate back.
#[tauri::command]
pub async fn browser_go_back(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    wv.eval("history.back()").map_err(|e| format!("eval failed: {e}"))?;
    Ok(())
}

/// Navigate forward.
#[tauri::command]
pub async fn browser_go_forward(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    wv.eval("history.forward()").map_err(|e| format!("eval failed: {e}"))?;
    Ok(())
}

/// Reload the page.
#[tauri::command]
pub async fn browser_reload(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    wv.eval("location.reload()").map_err(|e| format!("eval failed: {e}"))?;
    Ok(())
}

/// Show or hide the webview.
#[tauri::command]
pub async fn browser_set_visible(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
    visible: bool,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    if visible {
        // Make it visible and sized for viewing
        wv.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(0.0, 0.0)))
            .map_err(|e| format!("set_position: {e}"))?;
        let win = app.get_window("main").ok_or("No main window")?;
        let win_size = win.inner_size().map_err(|e| format!("inner_size: {e}"))?;
        wv.set_size(tauri::Size::Physical(win_size))
            .map_err(|e| format!("set_size: {e}"))?;
        wv.show().map_err(|e| format!("show failed: {e}"))?;
    } else {
        wv.hide().map_err(|e| format!("hide failed: {e}"))?;
    }
    Ok(())
}

/// Resize and reposition the browser webview.
#[tauri::command]
pub async fn browser_set_bounds(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    wv.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)))
        .map_err(|e| format!("set_position: {e}"))?;
    wv.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|e| format!("set_size: {e}"))?;
    Ok(())
}

/// Open DevTools for the browser webview.
#[tauri::command]
pub async fn browser_open_devtools(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    wv.open_devtools();
    Ok(())
}

/// Get the current URL of the browser.
#[tauri::command]
pub async fn browser_get_url(
    _app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<String, String> {
    let instances = state.instances.lock().unwrap();
    let inst = instances.get(&id).ok_or("Browser not found")?;
    Ok(inst.url.clone())
}

/// Execute JavaScript in the browser webview and return void.
#[tauri::command]
pub async fn browser_eval(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
    script: String,
) -> Result<(), String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        instances.get(&id).ok_or("Browser not found")?.label.clone()
    };
    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    wv.eval(&script).map_err(|e| format!("eval failed: {e}"))?;
    Ok(())
}

/// List all active browser instances.
#[tauri::command]
pub fn browser_list(
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
) -> Vec<String> {
    state.instances.lock().unwrap().keys().cloned().collect()
}

/// Pop out the browser in a detached window for visual inspection.
#[tauri::command]
pub async fn browser_pop_out(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<(), String> {
    let (label, url) = {
        let instances = state.instances.lock().unwrap();
        let inst = instances.get(&id).ok_or("Browser not found")?;
        (inst.label.clone(), inst.url.clone())
    };

    let detached_label = format!("{label}-detached");

    // If detached window already exists, focus it
    if let Some(win) = app.get_webview_window(&detached_label) {
        let _ = win.set_focus();
        return Ok(());
    }

    // Create a new detached WebviewWindow pointing to the same URL
    use tauri::WebviewWindowBuilder;
    let parsed: url::Url = url.parse().map_err(|e| format!("Invalid URL: {e}"))?;
    WebviewWindowBuilder::new(&app, &detached_label, WebviewUrl::External(parsed))
        .title(&format!("Browser — {url}"))
        .inner_size(1024.0, 768.0)
        .min_inner_size(400.0, 300.0)
        .build()
        .map_err(|e| format!("Failed to create window: {e}"))?;

    Ok(())
}
