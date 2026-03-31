// Static config (from env)
export const config = {
  port: Number(process.env.PORT) || 47300,
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:47532/do_it_now",
  vpsApiUrl: process.env.VPS_API_URL || "https://api.tomexplore.com",
  vpsApiToken: process.env.VPS_API_TOKEN || "",
  ovhApiBase: process.env.OVH_API_BASE || "https://eu.api.ovh.com/1.0",
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
