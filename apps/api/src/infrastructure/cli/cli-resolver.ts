import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";

// Mirrors Tauri's app_local_data_dir() for identifier "com.bumblelab.magick-cookie".
// BinaryManager installs CLIs at {app_local_data_dir}/cli-binaries/{name}/{name}[.exe].
const APP_ID = "com.bumblelab.magick-cookie";

function getCliBinDir(): string {
  const { platform, env } = process;
  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), APP_ID, "cli-binaries");
  }
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", APP_ID, "cli-binaries");
  }
  return join(env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), APP_ID, "cli-binaries");
}

export const CLI_BIN_DIR = getCliBinDir();

export function resolveCli(name: string): string | null {
  const ext = process.platform === "win32" ? ".exe" : "";
  const p = join(CLI_BIN_DIR, name, `${name}${ext}`);
  return existsSync(p) ? p : null;
}
