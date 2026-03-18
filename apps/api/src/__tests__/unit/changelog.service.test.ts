import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ChangelogService } from "../../application/changelog/changelog.service";
import type { GitScanService, GitCommit } from "../../application/git/git-scan.service";
import type { LlmService } from "../../application/llm/llm.service";

const makeCommit = (overrides: Partial<GitCommit> = {}): GitCommit => ({
  hash: "abc1234",
  message: "feat: add snippet CRUD",
  repo: "magick-cookie",
  ...overrides,
});

describe("ChangelogService", () => {
  let service: ChangelogService;
  let mockGitScan: { scanSince: ReturnType<typeof mock> };
  let mockLlm: { generateNarrative: ReturnType<typeof mock> };
  const since = new Date("2026-03-01");

  beforeEach(() => {
    mockGitScan = {
      scanSince: mock(() =>
        Promise.resolve({
          commits: [makeCommit()],
          repoCount: 1,
          totalCommits: 1,
        }),
      ),
    };
    mockLlm = {
      generateNarrative: mock(() => Promise.resolve("## Features\n- snippet CRUD")),
    };
    service = new ChangelogService(
      mockGitScan as unknown as GitScanService,
      mockLlm as unknown as LlmService,
    );
  });

  // --- generate with commits ---
  it("generate calls gitScan and LLM, returns commits + changelog", async () => {
    const result = await service.generate(since);

    expect(mockGitScan.scanSince).toHaveBeenCalledWith(since);
    expect(mockLlm.generateNarrative).toHaveBeenCalledTimes(1);
    expect(result.commits).toEqual([makeCommit()]);
    expect(result.changelog).toBe("## Features\n- snippet CRUD");
  });

  it("generate formats commit list correctly for LLM", async () => {
    const commits = [
      makeCommit({ hash: "aaa", message: "feat: one", repo: "repo-a" }),
      makeCommit({ hash: "bbb", message: "fix: two", repo: "repo-b" }),
    ];
    mockGitScan.scanSince.mockReturnValue(
      Promise.resolve({ commits, repoCount: 2, totalCommits: 2 }),
    );

    await service.generate(since);

    const expectedList = "- aaa feat: one (repo-a)\n- bbb fix: two (repo-b)";
    expect(mockLlm.generateNarrative).toHaveBeenCalledWith(
      expectedList,
      expect.stringContaining("changelog"),
    );
  });

  // --- generate with no commits ---
  it("generate returns empty changelog when no commits found", async () => {
    mockGitScan.scanSince.mockReturnValue(
      Promise.resolve({ commits: [], repoCount: 0, totalCommits: 0 }),
    );

    const result = await service.generate(since);

    expect(result.commits).toEqual([]);
    expect(result.changelog).toBe("Aucun commit trouve.");
    expect(mockLlm.generateNarrative).not.toHaveBeenCalled();
  });

  // --- generate with repo filter ---
  it("generate filters commits by repo when repoFilter provided", async () => {
    const commits = [
      makeCommit({ repo: "api" }),
      makeCommit({ hash: "def5678", repo: "desktop" }),
    ];
    mockGitScan.scanSince.mockReturnValue(
      Promise.resolve({ commits, repoCount: 2, totalCommits: 2 }),
    );

    const result = await service.generate(since, "api");

    expect(result.commits).toEqual([makeCommit({ repo: "api" })]);
    expect(mockLlm.generateNarrative).toHaveBeenCalledTimes(1);
  });

  it("generate with repo filter returns empty when no matching commits", async () => {
    const commits = [makeCommit({ repo: "desktop" })];
    mockGitScan.scanSince.mockReturnValue(
      Promise.resolve({ commits, repoCount: 1, totalCommits: 1 }),
    );

    const result = await service.generate(since, "api");

    expect(result.commits).toEqual([]);
    expect(result.changelog).toBe("Aucun commit trouve.");
    expect(mockLlm.generateNarrative).not.toHaveBeenCalled();
  });

  // --- generate with no gitScanService ---
  it("generate throws when gitScanService is undefined", async () => {
    const serviceNoGit = new ChangelogService(
      undefined,
      mockLlm as unknown as LlmService,
    );

    expect(serviceNoGit.generate(since)).rejects.toThrow("No git repos configured");
  });

  // --- LLM error propagation ---
  it("generate propagates LLM errors", async () => {
    mockLlm.generateNarrative.mockReturnValue(
      Promise.reject(new Error("LLM connection failed")),
    );

    expect(service.generate(since)).rejects.toThrow("LLM connection failed");
  });
});
