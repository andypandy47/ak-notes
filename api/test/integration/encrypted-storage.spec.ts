import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createVaultId } from "../../src/ids";
import { createVault, recoverVault, unlockVault } from "../../../app/src/features/vault/crypto";
import { issueToken } from "../../scripts/tokens.mts";
import { apiRequest, responseJson } from "../helpers/api-client";
import { resetDatabase } from "../helpers/seed";

const password = "test only: twelve quiet mountains";

describe("encrypted-storage integration", () => {
  beforeEach(resetDatabase);

  it("uses unique recovery material and rejects cryptographic substitution and tampering", async () => {
    const first = await createVault(password);
    const second = await createVault(password);
    expect(first.document.passphrase.salt).not.toBe(second.document.passphrase.salt);
    expect(first.document.recovery.nonce).not.toBe(second.document.recovery.nonce);
    expect(first.recoveryKey).not.toBe(second.recoveryKey);
    expect(first.key.extractable).toBe(false);
    await expect(createVault("")).rejects.toThrow();
    await expect(recoverVault(first.document, second.recoveryKey, password)).rejects.toThrow();
    const tampered = structuredClone(first.document);
    const ciphertext = tampered.passphrase.wrappedKey.ciphertext;
    tampered.passphrase.wrappedKey.ciphertext = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    await expect(unlockVault(tampered, password)).rejects.toThrow();
    await expect(
      unlockVault({ ...first.document, id: createVaultId() }, password),
    ).rejects.toThrow();
    await expect(
      unlockVault({ ...first.document, keyId: crypto.randomUUID() }, password),
    ).rejects.toThrow();
    await expect(
      unlockVault(
        {
          ...first.document,
          passphrase: { ...first.document.passphrase, iterations: 1 },
        } as unknown as typeof first.document,
        password,
      ),
    ).rejects.toThrow();
    await expect(
      unlockVault({ ...first.document, version: 2 } as unknown as typeof first.document, password),
    ).rejects.toThrow();
    await expect(
      recoverVault(
        { ...first.document, recovery: first.document.passphrase.wrappedKey },
        first.recoveryKey,
        password,
      ),
    ).rejects.toThrow();
  });

  it("rejects an incorrect passphrase without changing stored key material", async () => {
    const created = await createVault(password);
    await expect(unlockVault(created.document, "incorrect password")).rejects.toThrow();
  });

  it("persists only encrypted material and recovery preserves the encryption key", async () => {
    const nextPassword = "test only: another quiet mountain";
    const actor = await issueToken(env.DB, { label: "Recovery" });
    const created = await createVault(password);
    const plaintext = new TextEncoder().encode("Private page content");
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      created.key,
      plaintext,
    );
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: actor.token,
          method: "POST",
          json: created.document,
        })
      ).status,
    ).toBe(201);
    const stored = (
      await responseJson<{ vault: { revision: number; document: typeof created.document } }>(
        await apiRequest({ path: `/api/v1/vaults/${created.document.id}`, token: actor.token }),
      )
    ).vault;
    const serialized = JSON.stringify((await env.DB.prepare("SELECT * FROM vaults").all()).results);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(created.recoveryKey);
    expect(serialized).not.toContain("Private page content");
    const recovered = await recoverVault(stored.document, created.recoveryKey, nextPassword);
    expect(
      (
        await apiRequest({
          path: `/api/v1/vaults/${created.document.id}/passphrase`,
          token: actor.token,
          method: "PUT",
          json: { expectedRevision: stored.revision, passphrase: recovered.passphrase },
        })
      ).status,
    ).toBe(200);
    const updated = (
      await responseJson<{ vault: { document: typeof created.document } }>(
        await apiRequest({ path: `/api/v1/vaults/${created.document.id}`, token: actor.token }),
      )
    ).vault.document;
    await expect(unlockVault(updated, password)).rejects.toThrow();
    const key = await unlockVault(updated, nextPassword);
    expect(
      new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, encrypted)),
    ).toEqual(plaintext);
    expect(updated.keyId).toBe(created.document.keyId);
    expect(updated.recovery).toEqual(created.document.recovery);
    const recoveredAgain = await recoverVault(updated, created.recoveryKey, password);
    expect(
      new Uint8Array(
        await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, recoveredAgain.key, encrypted),
      ),
    ).toEqual(plaintext);
  });
});
