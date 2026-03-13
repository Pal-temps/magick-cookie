export const config = {
  port: Number(process.env.PORT) || 47300,
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:47532/do_it_now",
  clickupApiToken: process.env.CLICKUP_API_TOKEN || "",
} as const;
