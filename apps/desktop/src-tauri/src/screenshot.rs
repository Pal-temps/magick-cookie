use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use tauri::Manager;
use xcap::image;

use crate::ai::types::ImageData;
use crate::browser::BrowserStore;

/// Max width for screenshots sent to AI (keeps token cost low: ~1-2 tiles)
const MAX_WIDTH: u32 = 1280;

/// Resize an image to fit within MAX_WIDTH, preserving aspect ratio.
fn resize_for_ai(img: image::RgbaImage) -> image::RgbaImage {
    let (w, h) = (img.width(), img.height());
    if w <= MAX_WIDTH {
        return img;
    }
    let ratio = MAX_WIDTH as f32 / w as f32;
    let new_h = (h as f32 * ratio) as u32;
    image::imageops::resize(&img, MAX_WIDTH, new_h, image::imageops::FilterType::Lanczos3)
}

/// Encode an RGBA image as base64 PNG string.
fn encode_png_base64(img: &image::RgbaImage) -> Result<String, String> {
    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    let encoder = image::codecs::png::PngEncoder::new_with_quality(
        &mut cursor,
        image::codecs::png::CompressionType::Fast,
        image::codecs::png::FilterType::Adaptive,
    );
    image::ImageEncoder::write_image(
        encoder,
        img.as_raw(),
        img.width(),
        img.height(),
        image::ExtendedColorType::Rgba8,
    )
    .map_err(|e| format!("PNG encode error: {e}"))?;
    Ok(BASE64.encode(&buf))
}

/// Find the application window by matching the Tauri window title.
fn find_app_window(app: &tauri::AppHandle) -> Result<xcap::Window, String> {
    let tauri_window = app
        .webview_windows()
        .into_values()
        .next()
        .ok_or("No Tauri window found")?;
    let window_title = tauri_window.title().unwrap_or_default();

    let windows = xcap::Window::all().map_err(|e| format!("Window enumeration failed: {e}"))?;

    windows
        .into_iter()
        .find(|w| {
            let t = w.title();
            t.contains(&window_title) || t.contains("magick-cookie") || t.contains("Magick Cookie")
        })
        .ok_or_else(|| "Application window not found in window list".into())
}

/// Capture the application window as a base64-encoded PNG.
#[tauri::command]
pub fn capture_app_screenshot(app: tauri::AppHandle) -> Result<ImageData, String> {
    let target = find_app_window(&app)?;
    let img = target
        .capture_image()
        .map_err(|e| format!("Window capture failed: {e}"))?;

    let resized = resize_for_ai(img);
    let data = encode_png_base64(&resized)?;

    Ok(ImageData {
        media_type: "image/png".into(),
        data,
    })
}

/// Capture a specific region of the application window.
/// Coordinates are in pixels relative to the window top-left.
#[tauri::command]
pub fn capture_app_region(
    app: tauri::AppHandle,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<ImageData, String> {
    let target = find_app_window(&app)?;
    let full = target
        .capture_image()
        .map_err(|e| format!("Window capture failed: {e}"))?;

    // Clamp crop region to image bounds
    let (img_w, img_h) = (full.width(), full.height());
    let cx = x.min(img_w.saturating_sub(1));
    let cy = y.min(img_h.saturating_sub(1));
    let cw = width.min(img_w - cx);
    let ch = height.min(img_h - cy);

    let cropped = image::imageops::crop_imm(&full, cx, cy, cw, ch).to_image();
    let data = encode_png_base64(&cropped)?;

    Ok(ImageData {
        media_type: "image/png".into(),
        data,
    })
}

/// Capture a browser child webview by cropping the app window to the webview area.
#[tauri::command]
pub fn capture_browser_screenshot(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<BrowserStore>>,
    id: String,
) -> Result<ImageData, String> {
    let label = {
        let instances = state.instances.lock().unwrap();
        let inst = instances.get(&id).ok_or("Browser not found")?;
        inst.label.clone()
    };

    let wv = app.get_webview(&label).ok_or("Webview not found")?;
    let pos = wv.position().map_err(|e| format!("get position: {e}"))?;
    let size = wv.size().map_err(|e| format!("get size: {e}"))?;

    let target = find_app_window(&app)?;
    let full = target
        .capture_image()
        .map_err(|e| format!("Window capture failed: {e}"))?;

    let scale = full.width() as f64 / target.width() as f64;
    let cx = (pos.x as f64 * scale) as u32;
    let cy = (pos.y as f64 * scale) as u32;
    let cw = (size.width as f64 * scale) as u32;
    let ch = (size.height as f64 * scale) as u32;

    let (img_w, img_h) = (full.width(), full.height());
    let cx = cx.min(img_w.saturating_sub(1));
    let cy = cy.min(img_h.saturating_sub(1));
    let cw = cw.min(img_w - cx);
    let ch = ch.min(img_h - cy);

    let cropped = image::imageops::crop_imm(&full, cx, cy, cw, ch).to_image();
    let resized = resize_for_ai(cropped);
    let data = encode_png_base64(&resized)?;

    Ok(ImageData {
        media_type: "image/png".into(),
        data,
    })
}

/// Capture the primary monitor (full screen).
#[tauri::command]
pub fn capture_screen_screenshot() -> Result<ImageData, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Monitor enumeration failed: {e}"))?;

    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .ok_or("No primary monitor found")?;

    let img = primary
        .capture_image()
        .map_err(|e| format!("Screen capture failed: {e}"))?;

    let resized = resize_for_ai(img);
    let data = encode_png_base64(&resized)?;

    Ok(ImageData {
        media_type: "image/png".into(),
        data,
    })
}
