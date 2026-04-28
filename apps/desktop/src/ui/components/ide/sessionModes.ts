export type SessionModeId = "general" | "brief" | "triage" | "ide-dev" | "meeting-prep";

export interface SessionMode {
  id: SessionModeId;
  label: string;
  description: string;
  promptHint: string;
}

export const ALL_MODES: SessionMode[] = [
  {
    id: "general",
    label: "Général",
    description: "Accès à tous les outils",
    promptHint: "Mode general : tu as acces a tous les outils. Choisis celui qui correspond le mieux a la question.",
  },
  {
    id: "brief",
    label: "Brief",
    description: "Lecture seule — résumé / bilan",
    promptHint: "Mode brief : tu rediges un resume / bilan. Utilise UNIQUEMENT des outils en lecture — n'execute aucune action mutative (pas de creation, pas d'envoi, pas de modification).",
  },
  {
    id: "triage",
    label: "Triage",
    description: "Boîte de réception — classer, étoiler, archiver",
    promptHint: "Mode triage : tu tries la boite de reception. Tu peux marquer comme lu, etoiler, archiver, classer dans le flux, et capturer des notes rapides. Pas d'actions infra ni de devops.",
  },
  {
    id: "ide-dev",
    label: "IDE / Dev",
    description: "Workflow code — git, PRs, déploiement",
    promptHint: "Mode developpement : tu accompagnes du travail sur du code (issues, PRs/MRs, repos, deploiement). Les actions destructives ou irreversibles passent par confirmation utilisateur.",
  },
  {
    id: "meeting-prep",
    label: "Réunion",
    description: "Préparer une réunion — contexte, contacts, notes",
    promptHint: "Mode preparation de reunion : tu rassembles le contexte pour un evenement a venir. Pas d'envoi, pas de modification — seulement de la lecture.",
  },
];

const MODE_MAP = new Map<string, SessionMode>(ALL_MODES.map((m) => [m.id, m]));

export function getModeHint(mode: string): string | null {
  if (mode === "general") return null;
  return MODE_MAP.get(mode)?.promptHint ?? null;
}

export function getModeLabel(mode: string): string {
  return MODE_MAP.get(mode)?.label ?? mode;
}

export function buildModeContextPart(mode: string): string | null {
  const hint = getModeHint(mode);
  if (!hint) return null;
  const label = getModeLabel(mode);
  return `[Mode: ${label}]\n${hint}`;
}
