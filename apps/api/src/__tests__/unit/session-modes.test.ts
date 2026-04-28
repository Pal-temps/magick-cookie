import { describe, it, expect } from "bun:test";
import {
  ALL_SESSION_MODES,
  selectToolsForMode,
  getModePromptHint,
  getModeTools,
  type SessionMode,
} from "../../application/agent/session-modes";
import type { AgentTool } from "../../application/agent/tool-registry";

const stubTool = (name: string): AgentTool => ({
  name,
  description: `stub for ${name}`,
  parameters: {},
  permissionLevel: "auto",
  execute: async () => ({}),
});

describe("session-modes", () => {
  describe("ALL_SESSION_MODES", () => {
    it("includes the 5 modes from the AI plan", () => {
      expect(ALL_SESSION_MODES).toEqual(["general", "brief", "triage", "ide-dev", "meeting-prep"]);
    });
  });

  describe("selectToolsForMode", () => {
    const allRegistered = [
      stubTool("get_streak"),
      stubTool("get_today_stats"),
      stubTool("calendar_list"),
      stubTool("email_send"),
      stubTool("email_mark_read"),
      stubTool("email_star"),
      stubTool("set_flux"),
      stubTool("github_create_issue"),
      stubTool("ssh_exec"),
      stubTool("dns_create_record"),
      stubTool("contact_list"),
      stubTool("contact_find_by_email"),
      stubTool("notes_read"),
      stubTool("rss_generate_digest"),
      stubTool("save_memory"),
      stubTool("get_memories"),
    ];

    it("general returns the input unchanged", () => {
      const out = selectToolsForMode("general", allRegistered);
      expect(out).toBe(allRegistered);
    });

    it("brief excludes mutations like email_send and github_create_issue", () => {
      const out = selectToolsForMode("brief", allRegistered);
      const names = out.map((t) => t.name);
      // Read-only data tools are kept
      expect(names).toContain("get_streak");
      expect(names).toContain("rss_generate_digest");
      // Mutating tools are dropped
      expect(names).not.toContain("email_send");
      expect(names).not.toContain("github_create_issue");
      expect(names).not.toContain("ssh_exec");
    });

    it("triage keeps inbox mutations and drops infra tools", () => {
      const out = selectToolsForMode("triage", allRegistered);
      const names = out.map((t) => t.name);
      expect(names).toContain("email_mark_read");
      expect(names).toContain("email_star");
      expect(names).toContain("set_flux");
      // Infra is out of scope
      expect(names).not.toContain("ssh_exec");
      expect(names).not.toContain("dns_create_record");
      expect(names).not.toContain("github_create_issue");
    });

    it("ide-dev keeps git/github/ssh and drops triage tools", () => {
      const out = selectToolsForMode("ide-dev", allRegistered);
      const names = out.map((t) => t.name);
      expect(names).toContain("github_create_issue");
      expect(names).toContain("ssh_exec");
      expect(names).toContain("dns_create_record");
      // Inbox-style tools aren't part of an ide session
      expect(names).not.toContain("email_mark_read");
      expect(names).not.toContain("email_star");
      expect(names).not.toContain("set_flux");
    });

    it("meeting-prep keeps lookup tools (contacts, calendar, notes) and drops mutations", () => {
      const out = selectToolsForMode("meeting-prep", allRegistered);
      const names = out.map((t) => t.name);
      expect(names).toContain("calendar_list");
      expect(names).toContain("contact_find_by_email");
      expect(names).toContain("notes_read");
      // No sends, no mutations
      expect(names).not.toContain("email_send");
      expect(names).not.toContain("email_mark_read");
      expect(names).not.toContain("github_create_issue");
    });

    it("filters out unknown tools — a mode whitelist of names not yet registered yields no false positives", () => {
      const out = selectToolsForMode("triage", []);
      expect(out).toEqual([]);
    });
  });

  describe("getModePromptHint", () => {
    it("returns a non-empty hint for every mode", () => {
      for (const m of ALL_SESSION_MODES) {
        expect(getModePromptHint(m).length).toBeGreaterThan(0);
      }
    });

    it("the brief hint mentions read-only", () => {
      expect(getModePromptHint("brief")).toContain("lecture");
    });
  });

  describe("getModeTools", () => {
    it("returns null for general (no whitelist)", () => {
      expect(getModeTools("general")).toBeNull();
    });

    it("returns the whitelist for non-general modes", () => {
      const triageTools = getModeTools("triage");
      expect(Array.isArray(triageTools)).toBe(true);
      expect(triageTools).toContain("email_mark_read");
    });

    it("brief whitelist does not include any *_send / *_create tool name", () => {
      // Defense-in-depth: the whitelist itself shouldn't accidentally include a write tool.
      const tools = getModeTools("brief")!;
      const dangerous = tools.filter((t) => /_send$|_create$|_create_|_delete$|_delete_|_update$|_update_/.test(t));
      expect(dangerous).toEqual([]);
    });
  });

  describe("type contract", () => {
    it("SessionMode is the union of ALL_SESSION_MODES", () => {
      const m: SessionMode = "general";
      expect(ALL_SESSION_MODES).toContain(m);
    });
  });
});
