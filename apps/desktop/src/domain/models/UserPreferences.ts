export interface UserPreferences {
  version: 1;
  locale: "fr" | "en";
  theme: {
    theme: "dark" | "light" | "cookie";
    mode: "manual" | "auto-system" | "auto-schedule";
    schedule: { darkStart: number; darkEnd: number };
  };
  focus: { enabled: boolean };
  dashboard: { widgetOrder: string[]; hiddenWidgets: string[]; pinnedWidgets: string[] };
  shortcuts: { custom: [string, string][] };
  brief: {
    customTemplates: { id: string; name: string; prompt: string }[];
    activeTemplateId: string;
  };
  env: { customChecks: { name: string; url: string }[] };
  vps: { notificationsEnabled: boolean };
  sidebar: { sectionOrder: string[] };
  rss: { retentionDays: number };
  workspace: {
    rootDirs: string[];
    manualProjects: string[];
    favorites: string[];
    activeProjectPath: string | null;
  };
  infra: {
    // Secrets (ovhAppKey, cfApiToken, githubToken, etc.) are now in the KDBX vault
    gitlabUrl: string;
    servers: { id: string; label: string; host: string; port: number; user: string; authMethod: "key" | "password" }[];
    // keyPath and passwords are in the KDBX vault
  };
}

// Secrets are now stored in the KDBX vault, not in UserPreferences

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: 1,
  locale: "fr",
  theme: {
    theme: "cookie",
    mode: "manual",
    schedule: { darkStart: 20, darkEnd: 7 },
  },
  focus: { enabled: true },
  dashboard: {
    widgetOrder: [
      "timer", "daily-stats", "water", "fruits", "dog-walk",
      "today-events", "wellness", "alarms", "streak", "github-prs",
      "vps", "analytics",
    ],
    hiddenWidgets: [],
    pinnedWidgets: [],
  },
  shortcuts: { custom: [] },
  brief: { customTemplates: [], activeTemplateId: "standup-fr" },
  env: { customChecks: [] },
  vps: { notificationsEnabled: true },
  sidebar: { sectionOrder: ["favoris", "filtres", "contacts", "taches"] },
  rss: { retentionDays: 90 },
  workspace: {
    rootDirs: [],
    manualProjects: [],
    favorites: [],
    activeProjectPath: null,
  },
  infra: {
    gitlabUrl: "https://gitlab.com",
    servers: [],
  },
};
