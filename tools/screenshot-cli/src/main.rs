use clap::Parser;
use image::RgbaImage;
use minifb::{Key, MouseButton, MouseMode, Window, WindowOptions};
use std::path::PathBuf;

/// Screenshot capture with interactive region selection.
/// Captures the primary monitor, shows an overlay for region cropping,
/// and saves the result as PNG.
#[derive(Parser)]
#[command(name = "screenshot", about = "Capture screenshots with region selection")]
struct Args {
    /// Output file path (default: screenshot.png in current dir)
    #[arg(short, long, default_value = "screenshot.png")]
    output: PathBuf,

    /// Capture full screen without region selection
    #[arg(long)]
    full: bool,

    /// Max width for AI-optimized output (0 = no resize)
    #[arg(long, default_value = "1280")]
    max_width: u32,
}

fn main() {
    let args = Args::parse();

    // Capture primary monitor
    let monitors = xcap::Monitor::all().expect("Failed to enumerate monitors");
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .expect("No primary monitor found");

    println!("Capturing screen...");
    let full_img = primary
        .capture_image()
        .expect("Screen capture failed");

    if args.full {
        // Save full screen directly
        let output = maybe_resize(full_img, args.max_width);
        output.save(&args.output).expect("Failed to save image");
        println!("Saved full screenshot to {}", args.output.display());
        return;
    }

    // Show interactive region selector
    let (fw, fh) = (full_img.width(), full_img.height());

    // Scale down to fit in a reasonable window (max 1600x900)
    let scale = f32::min(1600.0 / fw as f32, 900.0 / fh as f32).min(1.0);
    let win_w = (fw as f32 * scale) as usize;
    let win_h = (fh as f32 * scale) as usize;

    // Convert RGBA to u32 buffer for minifb (ARGB format)
    let base_buffer = rgba_to_argb_scaled(&full_img, win_w, win_h);

    let mut window = Window::new(
        "Screenshot — Selectionnez une zone (ESC = annuler)",
        win_w,
        win_h,
        WindowOptions {
            resize: false,
            topmost: true,
            borderless: false,
            ..WindowOptions::default()
        },
    )
    .expect("Failed to create window");

    window.set_target_fps(60);

    let mut drag_start: Option<(usize, usize)> = None;
    let mut drag_end: Option<(usize, usize)> = None;
    let mut selection: Option<(usize, usize, usize, usize)> = None; // x, y, w, h in window coords
    let mut confirmed = false;

    while window.is_open() && !window.is_key_down(Key::Escape) {
        // Check for Enter to confirm selection
        if window.is_key_pressed(Key::Enter, minifb::KeyRepeat::No) {
            if selection.is_some() {
                confirmed = true;
                break;
            }
        }

        // Mouse handling
        let mouse_down = window.get_mouse_down(MouseButton::Left);
        let mouse_pos = window.get_mouse_pos(MouseMode::Clamp);

        if let Some((mx, my)) = mouse_pos {
            let mx = mx as usize;
            let my = my as usize;

            if mouse_down {
                if drag_start.is_none() {
                    drag_start = Some((mx, my));
                }
                drag_end = Some((mx, my));
            } else if drag_start.is_some() {
                // Mouse released — finalize selection
                if let (Some((sx, sy)), Some((ex, ey))) = (drag_start, drag_end) {
                    let x1 = sx.min(ex);
                    let y1 = sy.min(ey);
                    let x2 = sx.max(ex);
                    let y2 = sy.max(ey);
                    let w = x2 - x1;
                    let h = y2 - y1;
                    if w > 10 && h > 10 {
                        selection = Some((x1, y1, w, h));
                    }
                }
                drag_start = None;
                drag_end = None;
            }
        }

        // Draw
        let mut buffer = base_buffer.clone();

        // Draw selection rectangle (while dragging or after selection)
        let rect = if let (Some((sx, sy)), Some((ex, ey))) = (drag_start, drag_end) {
            Some((sx.min(ex), sy.min(ey), sx.max(ex), sy.max(ey)))
        } else if let Some((x, y, w, h)) = selection {
            Some((x, y, x + w, y + h))
        } else {
            None
        };

        if let Some((x1, y1, x2, y2)) = rect {
            // Dim everything outside the selection
            for py in 0..win_h {
                for px in 0..win_w {
                    if px < x1 || px > x2 || py < y1 || py > y2 {
                        let idx = py * win_w + px;
                        if idx < buffer.len() {
                            // Darken by 50%
                            let pixel = buffer[idx];
                            let r = ((pixel >> 16) & 0xFF) / 2;
                            let g = ((pixel >> 8) & 0xFF) / 2;
                            let b = (pixel & 0xFF) / 2;
                            buffer[idx] = 0xFF00_0000 | (r << 16) | (g << 8) | b;
                        }
                    }
                }
            }

            // Draw border (cyan)
            let border_color: u32 = 0xFF_00CCFF;
            for px in x1..=x2.min(win_w - 1) {
                if y1 < win_h { buffer[y1 * win_w + px] = border_color; }
                if y2 < win_h { buffer[y2 * win_w + px] = border_color; }
            }
            for py in y1..=y2.min(win_h - 1) {
                if x1 < win_w { buffer[py * win_w + x1] = border_color; }
                if x2 < win_w { buffer[py * win_w + x2] = border_color; }
            }
        }

        // Show hint text area at top
        if selection.is_some() {
            // Green bar at top: "Appuyez sur Entree pour confirmer"
            for px in 0..win_w.min(300) {
                for py in 0..20 {
                    let idx = py * win_w + px;
                    if idx < buffer.len() {
                        buffer[idx] = 0xFF_005500;
                    }
                }
            }
        }

        window
            .update_with_buffer(&buffer, win_w, win_h)
            .expect("Failed to update window");
    }

    if confirmed {
        if let Some((sx, sy, sw, sh)) = selection {
            // Convert window coords back to full-resolution coords
            let rx = (sx as f32 / scale) as u32;
            let ry = (sy as f32 / scale) as u32;
            let rw = (sw as f32 / scale) as u32;
            let rh = (sh as f32 / scale) as u32;

            // Clamp to image bounds
            let rx = rx.min(fw - 1);
            let ry = ry.min(fh - 1);
            let rw = rw.min(fw - rx);
            let rh = rh.min(fh - ry);

            let cropped = image::imageops::crop_imm(&full_img, rx, ry, rw, rh).to_image();
            let output = maybe_resize(cropped, args.max_width);
            output.save(&args.output).expect("Failed to save image");
            println!("Saved cropped screenshot ({rw}x{rh}) to {}", args.output.display());
        }
    } else {
        println!("Cancelled.");
    }
}

/// Resize image if wider than max_width, preserving aspect ratio.
fn maybe_resize(img: RgbaImage, max_width: u32) -> RgbaImage {
    if max_width == 0 || img.width() <= max_width {
        return img;
    }
    let ratio = max_width as f32 / img.width() as f32;
    let new_h = (img.height() as f32 * ratio) as u32;
    image::imageops::resize(&img, max_width, new_h, image::imageops::FilterType::Lanczos3)
}

/// Scale an RGBA image to target dimensions and convert to ARGB u32 buffer for minifb.
fn rgba_to_argb_scaled(img: &RgbaImage, target_w: usize, target_h: usize) -> Vec<u32> {
    let (src_w, src_h) = (img.width() as usize, img.height() as usize);
    let mut buf = vec![0u32; target_w * target_h];

    for y in 0..target_h {
        let sy = (y * src_h / target_h).min(src_h - 1);
        for x in 0..target_w {
            let sx = (x * src_w / target_w).min(src_w - 1);
            let pixel = img.get_pixel(sx as u32, sy as u32);
            let [r, g, b, _a] = pixel.0;
            buf[y * target_w + x] = 0xFF00_0000 | ((r as u32) << 16) | ((g as u32) << 8) | (b as u32);
        }
    }

    buf
}
