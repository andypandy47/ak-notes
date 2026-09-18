import { z } from "zod";

const appEnvironmentSchema = z.enum(["local", "preview", "production"]);

const envSchema = z
  .object({
    DEV: z.boolean(),
    VITE_API_URL: z.url().optional(),
    VITE_APP_ENV: appEnvironmentSchema.optional(),
  })
  .transform((values) => ({
    ...values,
    VITE_APP_ENV: values.VITE_APP_ENV ?? (values.DEV ? "local" : "production"),
  }));

export const env = envSchema.parse(import.meta.env);
