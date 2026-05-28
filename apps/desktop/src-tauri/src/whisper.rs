use std::path::PathBuf;
use std::process::Command;

use tauri::{AppHandle, Emitter, Manager};

const MODEL_FILENAME: &str = "ggml-small.bin";
const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
const CLI_URL: &str =
    "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip";
const CLI_FILENAME: &str = "whisper-cli.exe";

fn whisper_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("no app data dir")
        .join("whisper");
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn model_path(app: &AppHandle) -> PathBuf {
    whisper_dir(app).join(MODEL_FILENAME)
}

fn cli_path(app: &AppHandle) -> PathBuf {
    whisper_dir(app).join(CLI_FILENAME)
}

#[tauri::command]
pub async fn check_whisper_model(app: AppHandle) -> Result<bool, String> {
    Ok(model_path(&app).exists() && cli_path(&app).exists())
}

async fn download_file(
    url: &str,
    dest: &std::path::Path,
    app: &AppHandle,
    event_name: &str,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();

    let tmp_path = dest.with_extension("tmp");
    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| format!("Cannot create file: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut last_pct: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {e}"))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let pct = (downloaded * 100) / total_size;
            if pct != last_pct {
                last_pct = pct;
                app.emit(
                    event_name,
                    serde_json::json!({
                        "downloaded": downloaded,
                        "total": total_size,
                        "percent": pct,
                    }),
                )
                .ok();
            }
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {e}"))?;
    drop(file);

    tokio::fs::rename(&tmp_path, dest)
        .await
        .map_err(|e| format!("Rename error: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn download_whisper_model(app: AppHandle) -> Result<(), String> {
    let cli = cli_path(&app);
    let model = model_path(&app);

    // Download CLI binary if missing
    if !cli.exists() {
        let zip_path = whisper_dir(&app).join("whisper-cli.zip");
        download_file(CLI_URL, &zip_path, &app, "whisper-download-progress").await?;

        // Extract ALL files from the zip (exe + DLLs)
        let zip_data = std::fs::read(&zip_path).map_err(|e| format!("Cannot read zip: {e}"))?;
        let reader = std::io::Cursor::new(zip_data);
        let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Invalid zip: {e}"))?;

        let dest_dir = whisper_dir(&app);
        let mut found_cli = false;
        for i in 0..archive.len() {
            let mut entry = archive
                .by_index(i)
                .map_err(|e| format!("Zip entry error: {e}"))?;
            let name = entry.name().to_string();

            // Skip directories
            if entry.is_dir() {
                continue;
            }

            // Get just the filename (strip any directory prefix in zip)
            let filename = std::path::Path::new(&name)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or(name.clone());

            // Rename the whisper exe to our expected name
            let out_name = if filename.ends_with(".exe") && filename.contains("whisper") {
                found_cli = true;
                CLI_FILENAME.to_string()
            } else {
                filename
            };

            let out_path = dest_dir.join(&out_name);
            let mut out = std::fs::File::create(&out_path)
                .map_err(|e| format!("Cannot create {out_name}: {e}"))?;
            std::io::copy(&mut entry, &mut out)
                .map_err(|e| format!("Extract {out_name} error: {e}"))?;
        }

        if !found_cli {
            let names: Vec<String> = (0..archive.len())
                .filter_map(|i| archive.by_index(i).ok().map(|e| e.name().to_string()))
                .collect();
            return Err(format!(
                "No whisper exe found in zip. Contents: {:?}",
                names
            ));
        }

        // Cleanup zip
        std::fs::remove_file(&zip_path).ok();
    }

    // Download model if missing
    if !model.exists() {
        download_file(MODEL_URL, &model, &app, "whisper-download-progress").await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    samples: Vec<f32>,
    sample_rate: u32,
) -> Result<String, String> {
    let cli = cli_path(&app);
    let model = model_path(&app);

    if !cli.exists() || !model.exists() {
        return Err("Whisper not installed. Download model first.".into());
    }

    // Write samples to a temporary WAV file
    let tmp_wav = whisper_dir(&app).join("input.wav");
    write_wav(&tmp_wav, &samples, sample_rate).map_err(|e| format!("Cannot write WAV: {e}"))?;

    // Run whisper-cli
    let output = Command::new(&cli)
        .arg("-m")
        .arg(&model)
        .arg("-l")
        .arg("fr")
        .arg("-nt") // no timestamps
        .arg("-f")
        .arg(&tmp_wav)
        .output()
        .map_err(|e| format!("Failed to run whisper: {e}"))?;

    // Cleanup temp file
    std::fs::remove_file(&tmp_wav).ok();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "Whisper error (code {:?}): stderr={} stdout={}",
            output.status.code(),
            stderr,
            stdout
        ));
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();

    Ok(text)
}

fn write_wav(path: &PathBuf, samples: &[f32], sample_rate: u32) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer =
        hound::WavWriter::create(path, spec).map_err(|e| format!("WAV create error: {e}"))?;

    for &s in samples {
        let val = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
        writer
            .write_sample(val)
            .map_err(|e| format!("WAV write error: {e}"))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("WAV finalize error: {e}"))?;

    Ok(())
}
