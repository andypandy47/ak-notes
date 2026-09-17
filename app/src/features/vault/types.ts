import { z } from "zod";
import { VaultId } from "../../lib/ids";

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

export type VaultSession = { key: CryptoKey; vault: VaultRecord };
