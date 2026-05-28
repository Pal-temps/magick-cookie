use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};

use super::manifest::{ArchiveType, Manifest, ManifestError, Triple};

/// Where on disk we install runtime-downloaded CLIs. One folder per CLI:
///   <root>/<cli_name>/<cli_name>[.exe]
const SUBDIR: &str = "cli-binaries";

#[derive(Debug)]
pub enum BinaryManagerError {
    UnsupportedHostPlatform,
    Manifest(ManifestError),
    Io(io::Error),
    Http { url: String, status: u16 },
    Network(String),
    ChecksumMissing(String),
    ChecksumMismatch { expected: String, actual: String },
    ExtractFailed(String),
    InnerBinaryMissing(String),
}

impl std::fmt::Display for BinaryManagerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedHostPlatform => write!(f, "unsupported host platform"),
            Self::Manifest(e) => write!(f, "{e}"),
            Self::Io(e) => write!(f, "io error: {e}"),
            Self::Http { url, status } => write!(f, "GET {url} returned HTTP {status}"),
            Self::Network(e) => write!(f, "network error: {e}"),
            Self::ChecksumMissing(name) => write!(f, "no checksum entry for {name}"),
            Self::ChecksumMismatch { expected, actual } => {
                write!(f, "sha256 mismatch: expected {expected}, got {actual}")
            }
            Self::ExtractFailed(e) => write!(f, "extract failed: {e}"),
            Self::InnerBinaryMissing(p) => write!(f, "extracted binary missing at {p}"),
        }
    }
}

impl std::error::Error for BinaryManagerError {}

impl From<io::Error> for BinaryManagerError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}
impl From<ManifestError> for BinaryManagerError {
    fn from(e: ManifestError) -> Self {
        Self::Manifest(e)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct InstalledCli {
    pub name: String,
    pub version: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
pub struct AvailableCli {
    pub name: String,
    pub version: String,
    pub display_name: String,
    pub homepage: String,
    pub installed: bool,
}

/// Coarse-grained phases of an `install_with_progress()` run.
/// Mapped to event variants by the Tauri layer; keeping it as an enum here means callers
/// can match exhaustively and we don't leak event-name strings into the core.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallPhase {
    Downloading,
    Verifying,
    Extracting,
}

pub struct BinaryManager {
    install_root: PathBuf,
    manifest: Manifest,
    triple: Triple,
}

impl BinaryManager {
    /// `app_data_dir` should typically be `app.path().app_local_data_dir()` from Tauri.
    pub fn new(app_data_dir: &Path) -> Result<Self, BinaryManagerError> {
        let triple = Triple::host().ok_or(BinaryManagerError::UnsupportedHostPlatform)?;
        let manifest = Manifest::embedded()?;
        let install_root = app_data_dir.join(SUBDIR);
        fs::create_dir_all(&install_root)?;
        Ok(Self {
            install_root,
            manifest,
            triple,
        })
    }

    /// Used by tests to point at an arbitrary directory without going through Tauri.
    #[cfg(test)]
    pub fn with_root(install_root: PathBuf) -> Result<Self, BinaryManagerError> {
        let triple = Triple::host().ok_or(BinaryManagerError::UnsupportedHostPlatform)?;
        let manifest = Manifest::embedded()?;
        fs::create_dir_all(&install_root)?;
        Ok(Self {
            install_root,
            manifest,
            triple,
        })
    }

    #[cfg(test)]
    fn install_root(&self) -> &Path {
        &self.install_root
    }
    #[cfg(test)]
    fn host_triple(&self) -> Triple {
        self.triple
    }

    fn cli_dir(&self, name: &str) -> PathBuf {
        self.install_root.join(name)
    }

    fn cli_binary_path(&self, name: &str) -> PathBuf {
        let exe = if self.triple.is_windows() {
            format!("{name}.exe")
        } else {
            name.to_string()
        };
        self.cli_dir(name).join(exe)
    }

    /// Returns the on-disk path if the CLI is installed, else `None`.
    pub fn resolve(&self, name: &str) -> Option<PathBuf> {
        let p = self.cli_binary_path(name);
        if p.is_file() {
            Some(p)
        } else {
            None
        }
    }

    pub fn list_available(&self) -> Vec<AvailableCli> {
        self.manifest
            .cli_names()
            .into_iter()
            .map(|name| {
                let cli = self
                    .manifest
                    .cli(name)
                    .expect("cli_names returns valid keys");
                AvailableCli {
                    name: name.to_string(),
                    version: cli.version.clone(),
                    display_name: cli.display_name.clone(),
                    homepage: cli.homepage.clone(),
                    installed: self.resolve(name).is_some(),
                }
            })
            .collect()
    }

    pub fn list_installed(&self) -> Vec<InstalledCli> {
        self.manifest
            .cli_names()
            .into_iter()
            .filter_map(|name| {
                let path = self.resolve(name)?;
                let version = self.manifest.cli(name).ok()?.version.clone();
                Some(InstalledCli {
                    name: name.to_string(),
                    version,
                    path,
                })
            })
            .collect()
    }

    pub fn uninstall(&self, name: &str) -> Result<(), BinaryManagerError> {
        // Make sure the cli exists in the manifest — refuse to delete arbitrary folders.
        self.manifest.cli(name)?;
        let dir = self.cli_dir(name);
        if dir.exists() {
            fs::remove_dir_all(&dir)?;
        }
        Ok(())
    }

    /// Downloads, verifies, and extracts the CLI for the host triple.
    /// Idempotent: returns the existing path if already installed and `force=false`.
    /// Invokes `on_phase` whenever the install transitions to a new coarse phase; pass a
    /// no-op closure if you don't care about progress.
    pub fn install_with_progress<F: Fn(InstallPhase)>(
        &self,
        name: &str,
        force: bool,
        on_phase: F,
    ) -> Result<PathBuf, BinaryManagerError> {
        if !force {
            if let Some(p) = self.resolve(name) {
                return Ok(p);
            }
        }

        let asset = self.manifest.resolve(name, self.triple)?;
        let cli_dir = self.cli_dir(name);
        fs::create_dir_all(&cli_dir)?;

        let tmp_dir = cli_dir.join(".tmp-install");
        let _ = fs::remove_dir_all(&tmp_dir);
        fs::create_dir_all(&tmp_dir)?;

        let result = (|| -> Result<PathBuf, BinaryManagerError> {
            let archive_path = tmp_dir.join(&asset.archive_basename);
            on_phase(InstallPhase::Downloading);
            download_to(&asset.url, &archive_path)?;
            on_phase(InstallPhase::Verifying);
            verify_sha256(&asset.checksums_url, &archive_path, &asset.archive_basename)?;
            on_phase(InstallPhase::Extracting);
            extract(&archive_path, &tmp_dir, asset.archive)?;

            let inner = tmp_dir.join(&asset.inner_path);
            if !inner.is_file() {
                return Err(BinaryManagerError::InnerBinaryMissing(
                    inner.to_string_lossy().into_owned(),
                ));
            }

            let final_path = self.cli_binary_path(name);
            fs::copy(&inner, &final_path)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&final_path)?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&final_path, perms)?;
            }

            Ok(final_path)
        })();

        let _ = fs::remove_dir_all(&tmp_dir);
        result
    }
}

fn download_to(url: &str, dest: &Path) -> Result<(), BinaryManagerError> {
    let resp =
        reqwest::blocking::get(url).map_err(|e| BinaryManagerError::Network(e.to_string()))?;
    if !resp.status().is_success() {
        return Err(BinaryManagerError::Http {
            url: url.to_string(),
            status: resp.status().as_u16(),
        });
    }
    let bytes = resp
        .bytes()
        .map_err(|e| BinaryManagerError::Network(e.to_string()))?;
    let mut f = fs::File::create(dest)?;
    f.write_all(&bytes)?;
    Ok(())
}

fn fetch_text(url: &str) -> Result<String, BinaryManagerError> {
    let resp =
        reqwest::blocking::get(url).map_err(|e| BinaryManagerError::Network(e.to_string()))?;
    if !resp.status().is_success() {
        return Err(BinaryManagerError::Http {
            url: url.to_string(),
            status: resp.status().as_u16(),
        });
    }
    resp.text()
        .map_err(|e| BinaryManagerError::Network(e.to_string()))
}

pub(super) fn parse_checksum(checksums_file: &str, archive_basename: &str) -> Option<String> {
    for raw in checksums_file.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        // Match either "<hash>  <name>" (two spaces, GNU) or "<hash> <name>" (BSD).
        let (hash, name) = match line.split_once(char::is_whitespace) {
            Some((h, rest)) => (h, rest.trim_start()),
            None => continue,
        };
        if name == archive_basename {
            return Some(hash.to_string());
        }
    }
    None
}

fn verify_sha256(
    checksums_url: &str,
    archive_path: &Path,
    archive_basename: &str,
) -> Result<(), BinaryManagerError> {
    let checksums = fetch_text(checksums_url)?;
    let expected = parse_checksum(&checksums, archive_basename)
        .ok_or_else(|| BinaryManagerError::ChecksumMissing(archive_basename.to_string()))?;
    let actual = sha256_of_file(archive_path)?;
    if expected != actual {
        return Err(BinaryManagerError::ChecksumMismatch { expected, actual });
    }
    Ok(())
}

fn sha256_of_file(path: &Path) -> io::Result<String> {
    let mut f = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn extract(archive: &Path, out_dir: &Path, kind: ArchiveType) -> Result<(), BinaryManagerError> {
    match kind {
        ArchiveType::Zip => extract_zip(archive, out_dir),
        ArchiveType::TarGz => extract_tar_gz(archive, out_dir),
    }
}

fn extract_zip(archive: &Path, out_dir: &Path) -> Result<(), BinaryManagerError> {
    let f = fs::File::open(archive)?;
    let mut zip =
        zip::ZipArchive::new(f).map_err(|e| BinaryManagerError::ExtractFailed(e.to_string()))?;
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| BinaryManagerError::ExtractFailed(e.to_string()))?;
        let Some(rel) = entry.enclosed_name() else {
            continue;
        };
        let out_path = out_dir.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut out = fs::File::create(&out_path)?;
            io::copy(&mut entry, &mut out)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry.unix_mode() {
                    fs::set_permissions(&out_path, fs::Permissions::from_mode(mode))?;
                }
            }
        }
    }
    Ok(())
}

fn extract_tar_gz(archive: &Path, out_dir: &Path) -> Result<(), BinaryManagerError> {
    let f = fs::File::open(archive)?;
    let dec = flate2::read::GzDecoder::new(f);
    let mut tar = tar::Archive::new(dec);
    tar.unpack(out_dir)
        .map_err(|e| BinaryManagerError::ExtractFailed(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_manager() -> BinaryManager {
        let tmp = std::env::temp_dir().join(format!("mc-bm-test-{}", uuid::Uuid::new_v4()));
        BinaryManager::with_root(tmp).expect("BinaryManager::with_root")
    }

    #[test]
    fn install_root_is_created() {
        let bm = mk_manager();
        assert!(bm.install_root().is_dir());
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn resolve_returns_none_when_not_installed() {
        let bm = mk_manager();
        assert!(bm.resolve("gh").is_none());
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn list_available_marks_uninstalled_clis() {
        let bm = mk_manager();
        let avail = bm.list_available();
        let gh = avail.iter().find(|c| c.name == "gh").expect("gh listed");
        assert!(!gh.installed);
        assert_eq!(gh.display_name, "GitHub CLI");
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn list_installed_is_empty_initially() {
        let bm = mk_manager();
        assert!(bm.list_installed().is_empty());
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn uninstall_unknown_cli_returns_manifest_error() {
        let bm = mk_manager();
        let err = bm.uninstall("nope").unwrap_err();
        assert!(matches!(
            err,
            BinaryManagerError::Manifest(ManifestError::UnknownCli(_))
        ));
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn uninstall_known_but_absent_cli_is_a_noop() {
        let bm = mk_manager();
        bm.uninstall("gh")
            .expect("uninstalling absent gh should be Ok");
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn uninstall_removes_an_existing_binary() {
        let bm = mk_manager();
        // Simulate an installed gh by writing a fake binary.
        let dir = bm.install_root().join("gh");
        fs::create_dir_all(&dir).unwrap();
        let bin = bm.cli_binary_path("gh");
        fs::write(&bin, b"#!/bin/sh\necho fake\n").unwrap();
        assert!(bm.resolve("gh").is_some());

        bm.uninstall("gh").unwrap();
        assert!(bm.resolve("gh").is_none());
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn cli_binary_path_uses_exe_on_windows() {
        let bm = mk_manager();
        let p = bm.cli_binary_path("gh");
        if bm.host_triple().is_windows() {
            assert!(p.to_string_lossy().ends_with("gh.exe"));
        } else {
            assert!(p.to_string_lossy().ends_with("gh"));
            assert!(!p.to_string_lossy().ends_with(".exe"));
        }
        let _ = fs::remove_dir_all(bm.install_root());
    }

    #[test]
    fn parse_checksum_finds_the_hash_with_double_space() {
        let s = "abc123  gh_2.66.1_windows_amd64.zip\ndef456  gh_2.66.1_linux_amd64.tar.gz\n";
        assert_eq!(
            parse_checksum(s, "gh_2.66.1_linux_amd64.tar.gz"),
            Some("def456".into())
        );
    }

    #[test]
    fn parse_checksum_handles_single_space() {
        let s = "cafebabe gh_2.66.1_macOS_arm64.zip\n";
        assert_eq!(
            parse_checksum(s, "gh_2.66.1_macOS_arm64.zip"),
            Some("cafebabe".into())
        );
    }

    #[test]
    fn parse_checksum_returns_none_on_mismatch() {
        let s = "abc123  other.zip\n";
        assert_eq!(parse_checksum(s, "missing.zip"), None);
    }

    #[test]
    fn parse_checksum_is_not_fooled_by_partial_suffix_match() {
        let s = "abc123  gh_2.66.1_windows_amd64.zip\n";
        // "amd64.zip" shouldn't accidentally match the longer filename.
        assert_eq!(parse_checksum(s, "amd64.zip"), None);
    }

    #[test]
    fn parse_checksum_skips_blank_lines() {
        let s = "\n   \nabc123  thing.zip\n\n";
        assert_eq!(parse_checksum(s, "thing.zip"), Some("abc123".into()));
    }

    #[test]
    fn sha256_of_known_input_is_stable() {
        let dir = std::env::temp_dir().join(format!("mc-sha-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("hello.txt");
        fs::write(&p, b"hello").unwrap();
        // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        assert_eq!(
            sha256_of_file(&p).unwrap(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    /// End-to-end install + resolve + uninstall against the real GitHub CLI release.
    /// Skipped unless MAGICK_SMOKE_NETWORK=1 is set, like the TS smoke test.
    #[test]
    fn smoke_install_resolve_uninstall_real_gh() {
        if std::env::var("MAGICK_SMOKE_NETWORK").as_deref() != Ok("1") {
            eprintln!("skipping smoke (set MAGICK_SMOKE_NETWORK=1 to run)");
            return;
        }
        let bm = mk_manager();
        let path = bm
            .install_with_progress("gh", true, |_| {})
            .expect("install must succeed");
        assert!(path.is_file());
        let resolved = bm.resolve("gh").expect("resolve after install");
        assert_eq!(resolved, path);
        let listed = bm.list_installed();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "gh");
        bm.uninstall("gh").unwrap();
        assert!(bm.resolve("gh").is_none());
        let _ = fs::remove_dir_all(bm.install_root());
    }
}
