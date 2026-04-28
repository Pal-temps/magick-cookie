import { buildModeContextPart } from "./sessionModes";

export interface BuildContextPartsOptions {
  mode: string;
  claudeMd: string | null;
  workflowPart: string | null;
}

/**
 * Pure function — builds the ordered list of context parts to prepend to the first message.
 * Order: CLAUDE.md → workflow → mode hint (mode hint always last, closest to the message).
 */
export function buildContextParts(opts: BuildContextPartsOptions): string[] {
  const parts: string[] = [];

  if (opts.claudeMd) {
    parts.push(`[Contexte projet — CLAUDE.md]\n${opts.claudeMd}`);
  }

  if (opts.workflowPart) {
    parts.push(opts.workflowPart);
  }

  const modePart = buildModeContextPart(opts.mode);
  if (modePart) {
    parts.push(modePart);
  }

  return parts;
}
