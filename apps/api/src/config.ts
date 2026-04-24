// Static config (from env)
const defaultCorsOrigins = [
  "http://localhost:47420",
  "http://127.0.0.1:47420",
  "tauri://localhost",
  "https://tauri.localhost",
];

export const config = {
  port: Number(process.env.PORT) || 47300,
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:47532/magick_cookie",
  vpsApiUrl: process.env.VPS_API_URL || "https://api.tomexplore.com",
  vpsApiToken: process.env.VPS_API_TOKEN || "",
  ovhApiBase: process.env.OVH_API_BASE || "https://eu.api.ovh.com/1.0",
  // Bearer token required by the auth middleware for any mutating route.
  // Empty string = disabled (safe only when the API is bound to localhost).
  apiAuthToken: process.env.API_AUTH_TOKEN || "",
  corsOrigins: (process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean)) || defaultCorsOrigins,
};

// Dynamic config (from desktop app settings, hot-reloadable)
export const infraConfig = {
  ovhAppKey: "",
  ovhAppSecret: "",
  ovhConsumerKey: "",
  cfApiToken: "",
  githubToken: "",
  gitlabToken: "",
  gitlabUrl: "https://gitlab.com",
};

export function updateInfraConfig(update: Partial<typeof infraConfig>) {
  Object.assign(infraConfig, update);
}
