import path from "path";

/**
 * Returns true if a file path is within the Magick Cookie app source code
 * and should never be written by the AI.
 *
 * Protects:
 *   <appRoot>/apps/desktop/src/
 *   <appRoot>/apps/api/src/
 *   <appRoot>/apps/desktop/src-tauri/src/
 *   <appRoot>/tools/
 *
 * Uses a strict prefix check (dir + "/") to avoid false positives like
 * apps/desktop/src-tauri-extra matching apps/desktop/src.
 */
export function isProtectedSourcePath(filePath: string, appRoot: string): boolean {
  if (!appRoot || !filePath) return false;
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  const norm = abs.replace(/\\/g, "/");
  // Normalize: forward slashes + strip trailing slash
  const root = appRoot.replace(/\\/g, "/").replace(/\/$/, "");

  const protectedDirs = [
    `${root}/apps/desktop/src`,
    `${root}/apps/api/src`,
    `${root}/apps/desktop/src-tauri/src`,
    `${root}/tools`,
  ];

  // Match if norm is exactly the dir OR starts with dir + "/" (strict prefix)
  return protectedDirs.some((dir) => norm === dir || norm.startsWith(dir + "/"));
}
