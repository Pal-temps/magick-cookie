import type { GitScanService, GitCommit } from "../git/git-scan.service";
import type { LlmService } from "../llm/llm.service";

export class ChangelogService {
  constructor(
    private gitScanService: GitScanService | undefined,
    private llmService: LlmService,
  ) {}

  async generate(
    since: Date,
    repoFilter?: string,
  ): Promise<{ commits: GitCommit[]; changelog: string }> {
    if (!this.gitScanService)
      throw new Error("No git repos configured");

    const activity = await this.gitScanService.scanSince(since);
    let commits = activity.commits;

    if (repoFilter) {
      commits = commits.filter((c) => c.repo === repoFilter);
    }

    if (commits.length === 0) {
      return { commits: [], changelog: "Aucun commit trouve." };
    }

    const commitList = commits
      .map((c) => `- ${c.hash} ${c.message} (${c.repo})`)
      .join("\n");

    const changelog = await this.llmService.generateNarrative(
      commitList,
      "Genere un changelog structure en francais a partir de ces commits git. Groupe par type (Features, Fixes, Refactoring, Autres). Format Markdown.",
    );

    return { commits, changelog };
  }
}
