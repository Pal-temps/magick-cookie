// Identifier validation for anything interpolated into a shell command or a filesystem path.
// Rejects shell meta-characters, path separators, and anything that could escape an argument.

const IDENTIFIER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;
const DNS_LABEL_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const DNS_ZONE_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,252}[a-zA-Z0-9])?$/;

export function assertSafeIdentifier(value: string, label = "identifier"): string {
  if (typeof value !== "string" || !IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid ${label}: must match [a-zA-Z0-9][a-zA-Z0-9_-]{0,62}`);
  }
  return value;
}

export function assertSafeDnsLabel(value: string, label = "subdomain"): string {
  if (typeof value !== "string" || !DNS_LABEL_RE.test(value)) {
    throw new Error(`Invalid ${label}: must be a valid DNS label`);
  }
  return value;
}

export function assertSafeDnsZone(value: string, label = "zone"): string {
  if (typeof value !== "string" || !DNS_ZONE_RE.test(value)) {
    throw new Error(`Invalid ${label}: must be a valid DNS zone`);
  }
  return value;
}

// buildCommand / startCommand are intentionally user-supplied shell, but we still reject control
// characters so they cannot break out of the surrounding hook script or log channel.
export function assertSafeShellFragment(value: string, label = "command"): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}: not a string`);
  if (value.length === 0 || value.length > 2048) {
    throw new Error(`Invalid ${label}: length must be 1..2048`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b-\x1f\x7f]/.test(value)) {
    throw new Error(`Invalid ${label}: contains control characters`);
  }
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`Invalid ${label}: must be a single line`);
  }
  return value;
}

// POSIX single-quote escaping for shell-quoted arguments. Use when an identifier cannot be
// pre-validated (rare) — prefer assertSafeIdentifier for names we build paths from.
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
