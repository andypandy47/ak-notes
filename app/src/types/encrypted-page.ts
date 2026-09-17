import { z } from "zod";
import { PageId } from "../lib/ids";

export const PageEnvelope = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal("AES-256-GCM"),
  keyId: z.uuid(),
  nonce: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  ciphertext: z.base64(),
});

export const EncryptedPage = z.object({
  id: PageId,
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
  envelope: PageEnvelope,
});

export const EncryptedPageSummary = EncryptedPage.omit({ envelope: true }).extend({
  summaryEnvelope: PageEnvelope.nullable(),
});

export type PageEnvelope = z.infer<typeof PageEnvelope>;
export type EncryptedPage = z.infer<typeof EncryptedPage>;
export type EncryptedPageSummary = z.infer<typeof EncryptedPageSummary>;
