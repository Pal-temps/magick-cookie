export interface BuildRelayUrlOpts {
  token: string;
  vpsHost: string;
  port: number;
}

export interface SessionInfoInput {
  token: string;
  port: number;
  expiresAt: Date;
}

export interface SessionInfo {
  tokenPreview: string;
  port: number;
  remainingSeconds: number;
}

export function buildRelayUrl({ token, vpsHost, port }: BuildRelayUrlOpts): string {
  const base = vpsHost.replace(/\/$/, "");
  return `${base}/m?t=${token}&p=${port}`;
}

export function formatSessionInfo({ token, port, expiresAt }: SessionInfoInput): SessionInfo {
  const preview = token.length > 4 ? token.slice(0, 3) + "****" : token + "****";
  const remainingMs = expiresAt.getTime() - Date.now();
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  return { tokenPreview: preview, port, remainingSeconds };
}
