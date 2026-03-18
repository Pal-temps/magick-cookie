import { exec } from "child_process";
import { promisify } from "util";
import type { GitScanPort } from "../../domain/git/git-scan.port";

const execAsync = promisify(exec);

export class GitExecAdapter implements GitScanPort {
  async getCommitsSince(repoPath: string, since: string): Promise<{ hash: string; message: string }[]> {
    try {
      const { stdout } = await execAsync(
        `git -C "${repoPath}" log --since="${since}" --oneline --no-merges --format="%h %s"`,
        { timeout: 5000 },
      );
      const lines = stdout.trim().split("\n").filter(Boolean);
      return lines.map((line) => {
        const spaceIdx = line.indexOf(" ");
        return { hash: line.substring(0, spaceIdx), message: line.substring(spaceIdx + 1) };
      });
    } catch {
      return [];
    }
  }
}
