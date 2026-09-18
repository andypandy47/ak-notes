import { z } from "zod";

const appEnvironmentSchema = z.enum(["local", "preview", "production"]);

const envSchema = z
  .object({
    DEV: z.boolean(),
    VITE_API_URL: z.url().optional(),
    VITE_APP_ENV: appEnvironmentSchema.optional(),
    VITE_ENABLE_QUERY_DEVTOOLS: z.enum(["true", "false"]).optional(),
  })
  .transform((values) => ({
    ...values,
    ENABLE_QUERY_DEVTOOLS: values.DEV || values.VITE_ENABLE_QUERY_DEVTOOLS === "true",
    VITE_APP_ENV: values.VITE_APP_ENV ?? (values.DEV ? "local" : "production"),
  }));

export const env = envSchema.parse(import.meta.env);
