import { useSettingsStore } from "../stores/settingsStore";

export interface BriefTemplate {
  id: string;
  name: string;
  prompt: string;
  builtin?: boolean;
}

const settings = useSettingsStore();

export const BRIEF_PRESETS: BriefTemplate[] = [
  {
    id: "standup-fr",
    name: "Standup FR",
    builtin: true,
    prompt: `Tu es un assistant qui genere des briefs quotidiens pour un developpeur.

Regles :
- Ecris en francais
- 3-4 sections : "Hier", "Aujourd'hui", "Blocages", et optionnellement "Activite Git" si des commits sont presents
- 2-4 bullet points par section, pas plus
- Utilise des verbes d'action au passe compose (hier) et futur/infinitif (aujourd'hui)
- Si une section est vide, ecris "RAS"
- Mentionne les durees de focus si significatives (> 30min)
- Pour la section Git, resume les commits par repo (ex: "magick-cookie: 3 commits - refactoring timer, fix bug X")
- Sois concis et actionnable, pas de blabla

Format markdown avec ## pour les titres de section.`,
  },
  {
    id: "standup-en",
    name: "Standup EN",
    builtin: true,
    prompt: `You are an assistant generating daily standup briefs for a developer.
Rules:
- Write in English
- 3 sections: "Yesterday", "Today", "Blockers"
- 2-4 bullet points per section max
- Use past tense (yesterday) and future/infinitive (today)
- If a section is empty, write "N/A"
- Mention focus durations if significant (> 30min)
- Be concise and actionable
Format as markdown with ## for section titles.`,
  },
  {
    id: "manager-report",
    name: "Rapport manager",
    builtin: true,
    prompt: `Tu es un assistant qui genere des rapports d'activite pour un manager.
Regles :
- Ecris en francais professionnel
- 4 sections : "Accomplissements", "En cours", "Prochaines etapes", "Risques"
- Synthese haut niveau, pas de details techniques
- Mentionne les metriques (temps focus, nombre de taches, emails)
- Ton professionnel et factuel
Format markdown avec ## pour les titres de section.`,
  },
  {
    id: "changelog",
    name: "Changelog",
    builtin: true,
    prompt: `Tu es un assistant qui genere des changelogs a partir d'activite de dev.
Regles :
- Ecris en francais
- Focus sur les changements de code (commits git) et taches completees
- Sections : "Ajouts", "Corrections", "En cours"
- Format concis, une ligne par item
- Prefixe chaque item avec un emoji : ✨ ajout, 🐛 fix, 🔄 en cours
Format markdown.`,
  },
];

export function getCustomTemplates(): BriefTemplate[] {
  try {
    return settings.getBrief().customTemplates;
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: BriefTemplate[]): void {
  settings.patchBrief({ customTemplates: templates });
}

export function getAllTemplates(): BriefTemplate[] {
  return [...BRIEF_PRESETS, ...getCustomTemplates()];
}

export function getActiveTemplateId(): string {
  return settings.getBrief().activeTemplateId || "standup-fr";
}

export function setActiveTemplateId(id: string): void {
  settings.patchBrief({ activeTemplateId: id });
}

export function getTemplateById(id: string): BriefTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

export function getActiveTemplate(): BriefTemplate {
  const id = getActiveTemplateId();
  return getTemplateById(id) || BRIEF_PRESETS[0];
}

export function addCustomTemplate(name: string, prompt: string): BriefTemplate {
  const templates = getCustomTemplates();
  const id = `custom-${Date.now()}`;
  const template: BriefTemplate = { id, name, prompt };
  templates.push(template);
  saveCustomTemplates(templates);
  return template;
}

export function updateCustomTemplate(id: string, name: string, prompt: string): void {
  const templates = getCustomTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx >= 0) {
    templates[idx] = { ...templates[idx], name, prompt };
    saveCustomTemplates(templates);
  }
}

export function deleteCustomTemplate(id: string): void {
  const templates = getCustomTemplates().filter((t) => t.id !== id);
  saveCustomTemplates(templates);
  // If active template was deleted, reset to default
  if (getActiveTemplateId() === id) {
    setActiveTemplateId("standup-fr");
  }
}
