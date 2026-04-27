/**
 * Smoke test — exercises the full network → checksum → extract → exec chain
 * against the real GitHub CLI release. Skipped by default to keep the suite
 * offline; opt in with `MAGICK_SMOKE_NETWORK=1`.
 *
 *   MAGICK_SMOKE_NETWORK=1 bun test apps/desktop/scripts/__tests__/fetch-cli-binaries.smoke.test.ts
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  CLIS,
  GH_VERSION,
  currentTriple,
  fetchOne,
  targetBinaryName,
} from "../fetch-cli-binaries";

const SMOKE_ENABLED = process.env.MAGICK_SMOKE_NETWORK === "1";
const describeSmoke = SMOKE_ENABLED ? describe : describe.skip;

describeSmoke("fetch-cli-binaries (smoke, network)", () => {
  let workDir: string;

  afterAll(async () => {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  });

  it(
    "downloads, verifies checksum, extracts, and runs gh for the current platform",
    async () => {
      workDir = await mkdtemp(join(tmpdir(), "mc-fetch-cli-smoke-"));
      const triple = currentTriple();
      const gh = CLIS.find((c) => c.name === "gh")!;

      const binaryPath = await fetchOne(gh, triple, /* force */ true, workDir);

      // File present and non-trivial in size
      expect(binaryPath.endsWith(targetBinaryName("gh", triple))).toBe(true);
      const st = await stat(binaryPath);
      expect(st.isFile()).toBe(true);
      expect(st.size).toBeGreaterThan(1_000_000); // gh is tens of MB

      // Binary actually executes and reports the pinned version
      const res = spawnSync(binaryPath, ["--version"], { encoding: "utf-8" });
      expect(res.error).toBeUndefined();
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(`gh version ${GH_VERSION}`);
    },
    /* timeout */ 90_000,
  );

  it("is idempotent: a second call with force=false skips the download", async () => {
    // Reuses workDir from previous test (same describe block, sequential).
    const triple = currentTriple();
    const gh = CLIS.find((c) => c.name === "gh")!;

    const t0 = Date.now();
    const binaryPath = await fetchOne(gh, triple, /* force */ false, workDir);
    const elapsed = Date.now() - t0;

    expect(binaryPath.endsWith(targetBinaryName("gh", triple))).toBe(true);
    // Should be effectively instant (no network, no extraction). Allow 2s slack
    // for cold filesystem cache on slow CI runners.
    expect(elapsed).toBeLessThan(2_000);
  });
});

if (!SMOKE_ENABLED) {
  describe("fetch-cli-binaries (smoke, network)", () => {
    it.skip("set MAGICK_SMOKE_NETWORK=1 to run the real-network smoke test", () => {});
  });
}
