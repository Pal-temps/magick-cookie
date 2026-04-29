pub mod auth;
pub mod binary_manager;
pub mod commands;
pub mod manifest;

// Tauri commands are referenced via `devops::commands::cli_*` from `lib.rs` so that the
// `#[tauri::command]` macro's generated `__cmd__<name>` sibling resolves correctly —
// `pub use` only re-exports the function, not the companion macro.
pub use commands::{new_state, SharedBinaryManager};
