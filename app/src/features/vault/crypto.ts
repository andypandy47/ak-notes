import { VaultDocument, type PassphraseKey } from "./types";
import { createVaultId } from "../../lib/ids";

const encoder = new TextEncoder();
const encode = (value: string): Uint8Array<ArrayBuffer> => {
  const source = encoder.encode(value);
  const bytes = new Uint8Array(new ArrayBuffer(source.byteLength));
  bytes.set(source);
  return bytes;
};
const random = (length: number): Uint8Array<ArrayBuffer> =>
  crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
const base64 = (bytes: Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...bytes));
function decode(value: string) {
  const decoded = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  if (base64(bytes) !== value) {
    throw new Error("Invalid key encoding");
  }
  return bytes;
}
const importKey = (raw: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

function associatedData(
  document: Pick<VaultDocument, "id" | "keyId">,
  purpose: "passphrase" | "recovery",
  settings?: Omit<PassphraseKey, "wrappedKey">,
) {
  return encode(
    JSON.stringify([
      "aknotes-vault-key",
      1,
      document.id,
      document.keyId,
      "AES-256-GCM",
      purpose,
      ...(settings ? [settings.kdf, settings.iterations, settings.salt] : []),
    ]),
  );
}
async function derivePassphraseKey(
  passphrase: string,
  settings: Omit<PassphraseKey, "wrappedKey">,
) {
  if (!passphrase || passphrase.length > 1024) {
    throw new Error("Invalid passphrase length");
  }
  const bytes = encode(passphrase);
  try {
    const material = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: decode(settings.salt),
        iterations: settings.iterations,
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    bytes.fill(0);
  }
}
async function wrap(raw: Uint8Array<ArrayBuffer>, key: CryptoKey, aad: Uint8Array<ArrayBuffer>) {
  const nonce = random(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad, tagLength: 128 },
    key,
    raw,
  );
  return { nonce: base64(nonce), ciphertext: base64(new Uint8Array(ciphertext)) };
}
async function unwrap(
  wrapped: VaultDocument["recovery"],
  key: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
) {
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(wrapped.nonce), additionalData: aad, tagLength: 128 },
      key,
      decode(wrapped.ciphertext),
    ),
  );
  if (raw.length !== 32) {
    raw.fill(0);
    throw new Error("Invalid vault key");
  }
  return raw;
}
async function wrapWithPassphrase(
  raw: Uint8Array<ArrayBuffer>,
  identity: Pick<VaultDocument, "id" | "keyId">,
  passphrase: string,
): Promise<PassphraseKey> {
  const settings = { kdf: "PBKDF2-SHA-256", iterations: 600000, salt: base64(random(16)) } as const;
  const key = await derivePassphraseKey(passphrase, settings);
  return {
    ...settings,
    wrappedKey: await wrap(raw, key, associatedData(identity, "passphrase", settings)),
  };
}

export async function createVault(passphrase: string) {
  const identity = { id: createVaultId(), keyId: crypto.randomUUID() };
  const raw = random(32);
  const recovery = random(32);
  try {
    const passphraseWrapper = await wrapWithPassphrase(raw, identity, passphrase);
    const recoveryWrapper = await wrap(
      raw,
      await importKey(recovery),
      associatedData(identity, "recovery"),
    );
    const document = VaultDocument.parse({
      version: 1,
      ...identity,
      algorithm: "AES-256-GCM",
      passphrase: passphraseWrapper,
      recovery: recoveryWrapper,
    });
    return {
      document,
      key: await importKey(raw),
      recoveryKey: base64(recovery).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    };
  } finally {
    raw.fill(0);
    recovery.fill(0);
  }
}

export async function unlockVault(input: VaultDocument, passphrase: string) {
  const document = VaultDocument.parse(input);
  try {
    const wrappingKey = await derivePassphraseKey(passphrase, document.passphrase);
    const raw = await unwrap(
      document.passphrase.wrappedKey,
      wrappingKey,
      associatedData(document, "passphrase", document.passphrase),
    );
    try {
      return await importKey(raw);
    } finally {
      raw.fill(0);
    }
  } catch {
    throw new Error(
      "Could not unlock the vault. Check your passphrase; damaged key material can also cause this error.",
    );
  }
}

export async function recoverVault(
  input: VaultDocument,
  recoveryKey: string,
  newPassphrase: string,
) {
  const document = VaultDocument.parse(input);
  let raw: Uint8Array<ArrayBuffer>;
  try {
    const value = recoveryKey.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
      throw new Error("Invalid recovery key");
    }
    const recovery = decode(value.replace(/-/g, "+").replace(/_/g, "/") + "=");
    try {
      raw = await unwrap(
        document.recovery,
        await importKey(recovery),
        associatedData(document, "recovery"),
      );
    } finally {
      recovery.fill(0);
    }
  } catch {
    throw new Error(
      "Could not recover the vault. Check your recovery key; damaged key material can also cause this error.",
    );
  }
  try {
    return {
      key: await importKey(raw),
      passphrase: await wrapWithPassphrase(raw, document, newPassphrase),
    };
  } finally {
    raw.fill(0);
  }
}
