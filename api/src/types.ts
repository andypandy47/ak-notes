import type { Context } from "hono";
import { z } from "zod";
import { PageId, VaultId } from "./ids";

export type AppBindings = Pick<Env, "DB">;
export type AppEnvironment = { Bindings: AppBindings; Variables: { ownerId: string } };
export type AppContext = Context<AppEnvironment>;
export const VaultParams = z.object({ vaultId: VaultId });
export const PageParams = z.object({ pageId: PageId });
export const Envelope = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal("AES-256-GCM"),
  keyId: z.uuid(),
  nonce: z
    .string()
    .regex(/^[A-Za-z0-9+/]{16}$/)
    .describe("Base64-encoded fresh 12-byte nonce"),
  ciphertext: z
    .base64()
    .min(24)
    .max(700000)
    .describe("Encrypted page JSON followed by the 16-byte authentication tag, base64 encoded"),
});
export const Page = z.object({
  id: PageId,
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
  envelope: Envelope,
});
export const PageSummary = Page.omit({ envelope: true }).extend({
  summaryEnvelope: Envelope.nullable(),
});
export const SavePage = z
  .strictObject({
    expectedRevision: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1)
      .describe("0 creates a page; otherwise must match its current revision"),
    envelope: Envelope,
    summaryEnvelope: Envelope,
  })
  .refine((page) => page.envelope.keyId === page.summaryEnvelope.keyId, {
    message: "Page and summary envelopes must use the same key",
    path: ["summaryEnvelope", "keyId"],
  });

// Wire format v1. Keep aligned with the OpenAPI vault contract.
const WrappedKey = z.strictObject({
  nonce: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  ciphertext: z.string().regex(/^[A-Za-z0-9+/]{64}$/),
});
export const PassphraseKey = z.strictObject({
  kdf: z.literal("PBKDF2-SHA-256"),
  iterations: z.literal(600000),
  salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  wrappedKey: WrappedKey,
});
export const VaultDocument = z.strictObject({
  version: z.literal(1),
  id: VaultId,
  keyId: z.uuid(),
  algorithm: z.literal("AES-256-GCM"),
  passphrase: PassphraseKey,
  recovery: WrappedKey,
});
export const VaultRecord = z.strictObject({
  revision: z.number().int().positive(),
  document: VaultDocument,
});
export type VaultDocument = z.infer<typeof VaultDocument>;
export type VaultRecord = z.infer<typeof VaultRecord>;
export type PassphraseKey = z.infer<typeof PassphraseKey>;

export const ErrorBody = z.object({ success: z.literal(false), error: z.string() });

export const json = <T extends z.ZodType>(schema: T) => ({
  content: { "application/json": { schema } },
});

export const commonResponses = {
  "400": {
    description: "Malformed JSON or request validation failure",
    ...json(
      z.union([
        ErrorBody,
        z.object({
          success: z.literal(false),
          errors: z.array(
            z.object({
              code: z.number(),
              message: z.string(),
              path: z.array(z.string()).optional(),
            }),
          ),
          result: z.object({}),
        }),
      ]),
    ),
  },
  "401": { description: "Missing or invalid bearer token", ...json(ErrorBody) },
  "503": { description: "Authentication storage unavailable", ...json(ErrorBody) },
  "500": { description: "Unexpected server error", ...json(ErrorBody) },
};
export const security = [{ bearerAuth: [] }];
