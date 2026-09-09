import { z } from "zod";

const passphrase = z
  .string()
  .min(6, "Use at least 6 characters.")
  .max(1024, "Use no more than 1,024 characters.");
const newPassphrase = z.object({
  passphrase,
  confirm: z.string().min(1, "Confirm your passphrase."),
});
const matches = (data: { passphrase: string; confirm: string }) => data.passphrase === data.confirm;
const mismatch = { message: "The passphrases do not match.", path: ["confirm"] };

export const createVaultSchema = newPassphrase.refine(matches, mismatch);
export const unlockVaultSchema = z.object({
  passphrase: z
    .string()
    .min(1, "Enter your passphrase.")
    .max(1024, "Use no more than 1,024 characters."),
});
export const recoverVaultSchema = newPassphrase
  .extend({
    recovery: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{43}$/, "Enter the 43-character recovery key."),
  })
  .refine(matches, mismatch);
export const deviceTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43,128}$/, "Enter a valid API token (43–128 characters).");
export const connectVaultSchema = z.object({ token: deviceTokenSchema });
export type CreateVaultValues = z.infer<typeof createVaultSchema>;
export type UnlockVaultValues = z.infer<typeof unlockVaultSchema>;
export type RecoverVaultValues = z.infer<typeof recoverVaultSchema>;
export type ConnectVaultValues = z.infer<typeof connectVaultSchema>;
