// Transient: the BinaryManager API is consumed by Tauri commands added in the
// next step. Until then, suppress dead-code warnings on this module so the
// project's "cargo check passes warning-free" rule still holds.
#![allow(dead_code, unused_imports)]

pub mod binary_manager;
pub mod manifest;

pub use binary_manager::{AvailableCli, BinaryManager, BinaryManagerError, InstalledCli};
pub use manifest::{ArchiveType, Manifest, ManifestError, ResolvedAsset, Triple};
