export const config = {
  port: Number(process.env.PORT) || 47300,
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:47532/do_it_now",
  vpsApiUrl: process.env.VPS_API_URL || "https://api.tomexplore.com",
  vpsApiToken: process.env.VPS_API_TOKEN || "",
} as const;
