import { describe, expect, it } from "vitest";
import {
  ApiTokenId,
  PageId,
  UserId,
  VaultId,
  createApiTokenId,
  createPageId,
  createUserId,
  createVaultId,
} from "../../src/ids";
import { Envelope, PageParams, PassphraseKey, SavePage, VaultDocument } from "../../src/types";
import { validEnvelope } from "../factories/envelope";
import { validVault } from "../factories/vault";

describe("schema boundary validation", () => {
  it("accepts valid encrypted wire documents", () => {
    const vault = validVault();
    expect(VaultDocument.parse(vault)).toEqual(vault);
    expect(Envelope.parse(validEnvelope({ keyId: vault.keyId }))).toBeDefined();
    expect(PassphraseKey.parse(vault.passphrase)).toEqual(vault.passphrase);
  });

  it("generates and validates entity-prefixed ULIDs", () => {
    expect(UserId.parse(createUserId())).toMatch(/^usr_/);
    expect(VaultId.parse(createVaultId())).toMatch(/^vlt_/);
    expect(PageId.parse(createPageId())).toMatch(/^pag_/);
    expect(ApiTokenId.parse(createApiTokenId())).toMatch(/^tok_/);
  });

  it("rejects malformed and incorrectly prefixed page identifiers", () => {
    expect(() => PageParams.parse({ pageId: "not-a-ulid" })).toThrow();
    expect(() => PageParams.parse({ pageId: createVaultId() })).toThrow();
    expect(() => PageParams.parse({ pageId: createPageId().toLowerCase() })).toThrow();
  });

  it("rejects unknown plaintext and ownership fields", () => {
    const envelope = validEnvelope();
    for (const extra of [
      { title: "secret" },
      { ownerId: "other" },
      { vaultId: crypto.randomUUID() },
    ]) {
      expect(() =>
        SavePage.parse({ expectedRevision: 0, envelope, summaryEnvelope: envelope, ...extra }),
      ).toThrow();
    }
  });

  it("rejects mismatched summary keys and invalid revisions", () => {
    expect(() =>
      SavePage.parse({
        expectedRevision: 0,
        envelope: validEnvelope(),
        summaryEnvelope: validEnvelope(),
      }),
    ).toThrow();
    const envelope = validEnvelope();
    for (const expectedRevision of [-1, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(() =>
        SavePage.parse({ expectedRevision, envelope, summaryEnvelope: envelope }),
      ).toThrow();
    }
  });

  it("rejects invalid nonce, KDF, version, and raw key variants", () => {
    expect(() => Envelope.parse({ ...validEnvelope(), nonce: "invalid" })).toThrow();
    const vault = validVault();
    for (const invalid of [
      { ...vault, version: 2 },
      { ...vault, rawKey: "forbidden" },
      { ...vault, passphrase: { ...vault.passphrase, iterations: 1 } },
      { ...vault, passphrase: { ...vault.passphrase, kdf: "scrypt" } },
    ]) {
      expect(() => VaultDocument.parse(invalid)).toThrow();
    }
  });
});
