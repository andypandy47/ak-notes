import type { VaultDocument } from "../../src/types";
import { createVaultId } from "../../src/ids";
import { randomBase64 } from "./envelope";

export const validVault = (overrides: Partial<VaultDocument> = {}): VaultDocument => ({
  version: 1,
  id: createVaultId(),
  keyId: crypto.randomUUID(),
  algorithm: "AES-256-GCM",
  passphrase: {
    kdf: "PBKDF2-SHA-256",
    iterations: 600000,
    salt: randomBase64(16),
    wrappedKey: { nonce: randomBase64(12), ciphertext: randomBase64(48) },
  },
  recovery: { nonce: randomBase64(12), ciphertext: randomBase64(48) },
  ...overrides,
});
