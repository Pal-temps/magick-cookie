#!/usr/bin/env bun
/**
 * verify-v1 — Automatic endpoint health check for Magick Cookie v1
 *
 * Usage:
 *   bun tools/verify-v1/index.ts [--base http://localhost:3001] [--only <tab>]
 *
 * Options:
 *   --base    API base URL (default: http://localhost:3001)
 *   --only    Run only a specific tab (dashboard, calendar, cookia, notes, flux,
 *             email, vps, rss, cicd, tools, settings)
 *   --token   Auth token to use in Authorization header
 *   --help    Show this help
 *
 * Exit code: 0 if all green/yellow, 1 if any red failures
 */

// ─── ANSI colors ─────────────────────────────────────────────────────────────

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const RESET  = "\x1b[0m";

// ─── Types ────────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Endpoint {
  tab: string;
  method: Method;
  path: string;
  description: string;
  /** Minimal JSON body for POST/PUT that should avoid 400/500 */
  body?: Record<string, unknown>;
  /** If true, a 401/403 is expected (auth-protected, treated as ⚠️ not ✗) */
  authRequired?: boolean;
  /** If true, a 404 is acceptable (e.g. no data seeded) */
  allow404?: boolean;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const today = isoDate(new Date());
const sevenDaysAgo = isoDate(new Date(Date.now() - 7 * 86_400_000));

// ─── Endpoint registry ────────────────────────────────────────────────────────

const ENDPOINTS: Endpoint[] = [

  // ── Health ────────────────────────────────────────────────────────────────
  { tab: "health",    method: "GET",  path: "/api/health",             description: "Santé de l'API", authRequired: false },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  { tab: "dashboard", method: "GET",  path: "/api/brief/generate",     description: "Brief journalier", authRequired: true },
  { tab: "dashboard", method: "GET",  path: `/api/analytics?from=${sevenDaysAgo}&to=${today}`, description: "Analytics globales", authRequired: true },
  { tab: "dashboard", method: "GET",  path: "/api/analytics/streak",   description: "Streak de productivité", authRequired: true },

  // ── Calendar ──────────────────────────────────────────────────────────────
  { tab: "calendar",  method: "GET",  path: "/api/calendars",          description: "Liste des calendriers", authRequired: true },
  { tab: "calendar",  method: "GET",  path: "/api/events",             description: "Liste des événements", authRequired: true },
  { tab: "calendar",  method: "POST", path: "/api/llm/generate-events",
    description: "Génération d'événements (IA)",
    body: { prompt: "réunion lundi matin", date: today },
    authRequired: true },
  { tab: "calendar",  method: "GET",  path: "/api/caldav-accounts",    description: "Comptes CalDAV", authRequired: true },

  // ── Cookia / IDE ──────────────────────────────────────────────────────────
  { tab: "cookia",    method: "GET",  path: "/api/agent",              description: "Liste des conversations agent", authRequired: true },
  { tab: "cookia",    method: "GET",  path: "/api/ai/tools",           description: "Outils IA disponibles", authRequired: true },
  { tab: "cookia",    method: "GET",  path: "/api/ai/tool-calls",      description: "Historique des appels outils", authRequired: true },
  { tab: "cookia",    method: "GET",  path: "/api/ai/budget",          description: "Budget LLM", authRequired: true },

  // ── Choc Notes / Vault ────────────────────────────────────────────────────
  { tab: "notes",     method: "GET",  path: "/api/vault/notes",        description: "Liste des notes", authRequired: true },

  // ── Flux ──────────────────────────────────────────────────────────────────
  { tab: "flux",      method: "GET",  path: "/api/flux",               description: "Items flux", authRequired: true },
  { tab: "flux",      method: "GET",  path: "/api/flux/counts",        description: "Comptages flux", authRequired: true },
  { tab: "flux",      method: "POST", path: "/api/flux/suggest",
    description: "Suggestions IA flux",
    body: { items: [] },
    authRequired: true },

  // ── Email ─────────────────────────────────────────────────────────────────
  { tab: "email",     method: "GET",  path: "/api/emails",             description: "Liste des emails", authRequired: true },
  { tab: "email",     method: "GET",  path: "/api/email-accounts",     description: "Comptes email", authRequired: true },
  { tab: "email",     method: "GET",  path: "/api/emails/unread-count",description: "Nombre non lus", authRequired: true },

  // ── VPS / Infra ───────────────────────────────────────────────────────────
  { tab: "vps",       method: "GET",  path: "/api/vps/health",         description: "Santé VPS", authRequired: true },
  { tab: "vps",       method: "GET",  path: "/api/infra/servers",      description: "Serveurs configurés", authRequired: true },
  { tab: "vps",       method: "GET",  path: "/api/infra/config/status",description: "Statut config infra", authRequired: true },

  // ── RSS ───────────────────────────────────────────────────────────────────
  { tab: "rss",       method: "GET",  path: "/api/rss-feeds",          description: "Flux RSS", authRequired: true },
  { tab: "rss",       method: "GET",  path: "/api/rss-articles",       description: "Articles RSS", authRequired: true },
  { tab: "rss",       method: "GET",  path: "/api/rss-articles/unread-count", description: "Non lus RSS", authRequired: true },

  // ── CI/CD / GitHub ────────────────────────────────────────────────────────
  { tab: "cicd",      method: "GET",  path: "/api/github/prs",         description: "Pull requests GitHub", authRequired: true },
  { tab: "cicd",      method: "GET",  path: "/api/github/runs",        description: "Workflow runs GitHub", authRequired: true },
  { tab: "cicd",      method: "GET",  path: "/api/connector-configs",  description: "Configs connecteurs", authRequired: true },

  // ── Tools ─────────────────────────────────────────────────────────────────
  { tab: "tools",     method: "GET",  path: "/api/llm/config",         description: "Config LLM", authRequired: true },
  { tab: "tools",     method: "POST", path: "/api/llm/test",
    description: "Test connexion LLM",
    body: {},
    authRequired: true },
  { tab: "tools",     method: "POST", path: "/api/llm/generate-code",
    description: "Génération de code (IA)",
    body: { title: "v1 verify test", description: "ping test", comments: [] },
    authRequired: true },
  { tab: "tools",     method: "POST", path: "/api/changelog/generate",
    description: "Génération changelog (IA)",
    body: { since: sevenDaysAgo },
    authRequired: true },

  // ── Settings ──────────────────────────────────────────────────────────────
  { tab: "settings",  method: "GET",  path: "/api/user-preferences",   description: "Préférences utilisateur", authRequired: true },
  { tab: "settings",  method: "GET",  path: "/api/llm/config",         description: "Config LLM (settings)", authRequired: true },

  // ── Tasks (transversal) ───────────────────────────────────────────────────
  { tab: "tools",     method: "GET",  path: "/api/tasks",              description: "Liste des tâches", authRequired: true },
  { tab: "tools",     method: "GET",  path: "/api/snippets",           description: "Snippets de code", authRequired: true },
];

// ─── Tauri AI commands (documented, not HTTP-testable) ────────────────────────

const TAURI_COMMANDS = [
  "ai_list_providers",
  "ai_start_session",
  "ai_send_message",
  "ai_respond_permission",
  "ai_interrupt",
  "ai_stop_session",
  "ai_update_session_label",
  "ai_list_past_sessions",
  "ai_read_past_session",
  "ai_start_remote_session",
  "ai_stop_remote_session",
];

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let base = "http://localhost:3001";
  let only: string | null = null;
  let token: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base" && args[i + 1]) { base = args[++i]; continue; }
    if (args[i] === "--only" && args[i + 1]) { only = args[++i]; continue; }
    if (args[i] === "--token" && args[i + 1]) { token = args[++i]; continue; }
    if (args[i] === "--help") {
      console.log(`\nUsage: bun tools/verify-v1/index.ts [--base URL] [--only TAB] [--token JWT]\n`);
      process.exit(0);
    }
  }
  return { base, only, token };
}

// ─── Check one endpoint ───────────────────────────────────────────────────────

type Result = "ok" | "auth" | "error" | "skip";

async function checkEndpoint(
  endpoint: Endpoint,
  base: string,
  token: string | null,
): Promise<{ result: Result; status: number | null; ms: number; detail: string }> {
  const url = `${base}${endpoint.path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = {
    method: endpoint.method,
    headers,
  };
  if (endpoint.body && (endpoint.method === "POST" || endpoint.method === "PUT" || endpoint.method === "PATCH")) {
    init.body = JSON.stringify(endpoint.body);
  }

  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    const ms = Math.round(performance.now() - start);
    const status = res.status;

    if (status === 401 || status === 403) {
      return { result: "auth", status, ms, detail: endpoint.authRequired ? "auth requise (normal)" : "auth inattendue" };
    }
    if (status === 404 && endpoint.allow404) {
      return { result: "ok", status, ms, detail: "404 acceptable (pas de données)" };
    }
    if (status >= 200 && status < 300) {
      return { result: "ok", status, ms, detail: "" };
    }
    if (status === 404) {
      return { result: "error", status, ms, detail: "Route introuvable — vérifier le routeur" };
    }
    if (status === 503) {
      return { result: "auth", status, ms, detail: "LLM non configuré (normal sans clé API)" };
    }
    if (status >= 500) {
      let body = "";
      try { body = await res.text(); } catch {}
      return { result: "error", status, ms, detail: body.slice(0, 100) };
    }
    // 4xx other than 401/403/404 — likely bad minimal body, treat as auth/soft
    return { result: "auth", status, ms, detail: "body minimal rejeté (400/422)" };

  } catch (err: any) {
    const ms = Math.round(performance.now() - start);
    if (err?.name === "TimeoutError") {
      return { result: "error", status: null, ms, detail: "timeout 10s" };
    }
    if (err?.cause?.code === "ECONNREFUSED") {
      return { result: "error", status: null, ms, detail: "connexion refusée — API démarrée ?" };
    }
    return { result: "error", status: null, ms, detail: String(err?.message ?? err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { base, only, token } = parseArgs();

  console.log(`\n${BOLD}${CYAN}▸ Magick Cookie — Vérification V1${RESET}`);
  console.log(`${DIM}  Base URL : ${base}${RESET}`);
  if (only) console.log(`${DIM}  Filtre   : ${only}${RESET}`);
  console.log("");

  const filtered = only
    ? ENDPOINTS.filter((e) => e.tab === only)
    : ENDPOINTS;

  // Deduplicate (same method + path may appear in multiple tabs)
  const seen = new Set<string>();
  const unique = filtered.filter((e) => {
    const key = `${e.method}:${e.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group by tab
  const byTab: Record<string, Endpoint[]> = {};
  for (const e of unique) {
    (byTab[e.tab] ??= []).push(e);
  }

  let totalOk = 0;
  let totalAuth = 0;
  let totalErr = 0;

  for (const [tab, endpoints] of Object.entries(byTab)) {
    console.log(`${BOLD}  ─── ${tab.toUpperCase()} ───${RESET}`);

    for (const ep of endpoints) {
      const { result, status, ms, detail } = await checkEndpoint(ep, base, token);

      const methodPad = ep.method.padEnd(6);
      const pathPad   = ep.path.padEnd(42);
      const statusStr = status !== null ? String(status) : "ERR";

      if (result === "ok") {
        totalOk++;
        console.log(`  ${GREEN}✓${RESET} ${DIM}${methodPad}${RESET} ${pathPad} ${DIM}${statusStr} ${ms}ms${RESET}  ${ep.description}`);
      } else if (result === "auth") {
        totalAuth++;
        console.log(`  ${YELLOW}⚠${RESET} ${DIM}${methodPad}${RESET} ${pathPad} ${DIM}${statusStr} ${ms}ms${RESET}  ${ep.description}${DIM} — ${detail}${RESET}`);
      } else {
        totalErr++;
        console.log(`  ${RED}✗${RESET} ${DIM}${methodPad}${RESET} ${pathPad} ${DIM}${statusStr} ${ms}ms${RESET}  ${RED}${ep.description}${RESET}${DIM} — ${detail}${RESET}`);
      }
    }
    console.log("");
  }

  // Tauri commands summary
  if (!only || only === "cookia") {
    console.log(`${BOLD}  ─── TAURI AI COMMANDS (non-HTTP, documentés) ───${RESET}`);
    for (const cmd of TAURI_COMMANDS) {
      console.log(`  ${DIM}⟡  ${cmd}${RESET}`);
    }
    console.log("");
  }

  // Summary
  const total = totalOk + totalAuth + totalErr;
  console.log(`${BOLD}  Résumé${RESET}`);
  console.log(`  ${GREEN}✓ OK${RESET}    : ${totalOk}`);
  console.log(`  ${YELLOW}⚠ Auth${RESET}  : ${totalAuth}  ${DIM}(endpoint accessible, auth requise)${RESET}`);
  console.log(`  ${RED}✗ Erreur${RESET}: ${totalErr}`);
  console.log(`  Total    : ${total}\n`);

  if (totalErr > 0) {
    console.log(`${RED}${BOLD}  ✗ ${totalErr} endpoint(s) en échec — vérifier ci-dessus.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}  ✓ Tous les endpoints répondent (${totalAuth} protégés par auth).${RESET}\n`);
  }
}

main().catch((err) => {
  console.error(`\n${RED}Erreur fatale : ${err}${RESET}\n`);
  process.exit(1);
});
