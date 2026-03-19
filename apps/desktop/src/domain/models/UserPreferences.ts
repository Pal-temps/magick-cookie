export interface UserPreferences {
  version: 1;
  theme: {
    theme: "dark" | "light" | "cookie";
    mode: "manual" | "auto-system" | "auto-schedule";
    schedule: { darkStart: number; darkEnd: number };
  };
  focus: { enabled: boolean };
  dashboard: { widgetOrder: string[]; hiddenWidgets: string[] };
  shortcuts: { custom: [string, string][] };
  brief: {
    customTemplates: { id: string; name: string; prompt: string }[];
    activeTemplateId: string;
  };
  env: { customChecks: { name: string; url: string }[] };
  vps: { notificationsEnabled: boolean };
  sidebar: { sectionOrder: string[] };
  rss: { retentionDays: number };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: 1,
  theme: {
    theme: "dark",
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
  },
  shortcuts: { custom: [] },
  brief: { customTemplates: [], activeTemplateId: "standup-fr" },
  env: { customChecks: [] },
  vps: { notificationsEnabled: true },
  sidebar: { sectionOrder: ["favoris", "filtres", "contacts", "taches"] },
  rss: { retentionDays: 90 },
};
