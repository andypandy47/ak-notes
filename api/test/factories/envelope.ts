const randomBase64 = (length: number): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes));
};

export type EnvelopeFixture = {
  version: 1;
  algorithm: "AES-256-GCM";
  keyId: string;
  nonce: string;
  ciphertext: string;
};

export const validEnvelope = (input: string | Partial<EnvelopeFixture> = {}): EnvelopeFixture => {
  const overrides = typeof input === "string" ? { keyId: input } : input;
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    keyId: crypto.randomUUID(),
    nonce: randomBase64(12),
    ciphertext: randomBase64(32),
    ...overrides,
  };
};

export { randomBase64 };
