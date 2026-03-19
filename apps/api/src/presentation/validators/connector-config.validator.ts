import { z } from "zod";

export const connectorTypeSchema = z.enum(["clickup", "github", "gitlab"]);

export const upsertConnectorConfigSchema = z.object({
  token: z.string().min(1),
  settings: z.record(z.unknown()).optional().default({}),
});
