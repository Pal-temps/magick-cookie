import { describe, it, expect } from "bun:test";
import {
  SLASH_COMMANDS,
  parseSlashCommand,
  isSlashTrigger,
  filterCommands,
} from "../../ui/components/ide/slashCommands";

describe("parseSlashCommand", () => {
  it("retourne null si le texte ne commence pas par /", () => {
    expect(parseSlashCommand("hello /help")).toBeNull();
  });

  it("parse '/help' → { command: 'help', args: [] }", () => {
    expect(parseSlashCommand("/help")).toEqual({ command: "help", args: [] });
  });

  it("parse '/compact 10' → { command: 'compact', args: ['10'] }", () => {
    expect(parseSlashCommand("/compact 10")).toEqual({ command: "compact", args: ["10"] });
  });

  it("retourne null pour une chaîne vide", () => {
    expect(parseSlashCommand("")).toBeNull();
  });

  it("est case-insensitive pour le nom de commande", () => {
    expect(parseSlashCommand("/Help")?.command).toBe("help");
  });

  it("parse plusieurs args", () => {
    const result = parseSlashCommand("/model gpt-4o temperature");
    expect(result?.command).toBe("model");
    expect(result?.args).toEqual(["gpt-4o", "temperature"]);
  });

  it("trim les espaces autour", () => {
    expect(parseSlashCommand("  /help  ")?.command).toBe("help");
  });
});

describe("isSlashTrigger", () => {
  it("retourne true si '/' est le premier caractère", () => {
    expect(isSlashTrigger("/", 1)).toBe(true);
  });

  it("retourne false si '/' est au milieu du texte", () => {
    expect(isSlashTrigger("hello /help", 7)).toBe(false);
  });

  it("retourne false pour une chaîne vide", () => {
    expect(isSlashTrigger("", 0)).toBe(false);
  });

  it("retourne true pour '/compact' au début (cursor à 8)", () => {
    expect(isSlashTrigger("/compact", 8)).toBe(true);
  });

  it("retourne false si le texte commence par autre chose", () => {
    expect(isSlashTrigger("hello", 5)).toBe(false);
  });
});

describe("filterCommands", () => {
  it("retourne toutes les commandes si query vide", () => {
    expect(filterCommands("").length).toBeGreaterThan(5);
  });

  it("filtre par préfixe de nom", () => {
    const results = filterCommands("comp");
    expect(results.map((c) => c.name)).toContain("compact");
  });

  it("filtre par préfixe 'h' → inclut 'help'", () => {
    const results = filterCommands("h");
    expect(results.map((c) => c.name)).toContain("help");
  });

  it("ne retourne pas de doublons", () => {
    const results = filterCommands("");
    const names = results.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("retourne [] pour une query qui ne match rien", () => {
    expect(filterCommands("zzzzz")).toEqual([]);
  });
});

describe("SLASH_COMMANDS registre", () => {
  it("contient /help", () => {
    expect(SLASH_COMMANDS.find((c) => c.name === "help")).toBeDefined();
  });

  it("contient /clear", () => {
    expect(SLASH_COMMANDS.find((c) => c.name === "clear")).toBeDefined();
  });

  it("contient /compact", () => {
    expect(SLASH_COMMANDS.find((c) => c.name === "compact")).toBeDefined();
  });

  it("contient /remote-control", () => {
    expect(SLASH_COMMANDS.find((c) => c.name === "remote-control")).toBeDefined();
  });

  it("chaque commande a name, description, level (local|llm-assisted)", () => {
    for (const cmd of SLASH_COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(["local", "llm-assisted"]).toContain(cmd.level);
    }
  });

  it("contient au moins 10 commandes", () => {
    expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(10);
  });
});
