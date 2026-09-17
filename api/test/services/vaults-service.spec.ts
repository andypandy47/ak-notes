import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createVault,
  fetchVault,
  listVaults,
  updatePassphrase,
} from "../../src/vaults/vaults-service";
import { validVault } from "../factories/vault";
import { resetDatabase, seedAuthenticatedUser } from "../helpers/seed";

describe("vault service ownership and concurrency", () => {
  beforeEach(resetDatabase);

  it("creates, fetches, and lists only the owner's vault", async () => {
    const own = await seedAuthenticatedUser("own");
    const other = await seedAuthenticatedUser("other");
    const document = validVault();
    expect((await createVault(env.DB, own.ownerId, document))?.document).toEqual(document);
    expect(await createVault(env.DB, other.ownerId, document)).toBeNull();
    expect((await fetchVault(env.DB, own.ownerId, document.id))?.document).toEqual(document);
    expect(await fetchVault(env.DB, other.ownerId, document.id)).toBeNull();
    expect((await listVaults(env.DB, own.ownerId)).map(({ document }) => document.id)).toEqual([
      document.id,
    ]);
    expect(await listVaults(env.DB, other.ownerId)).toEqual([]);
  });

  it("atomically updates only the passphrase at the expected revision", async () => {
    const actor = await seedAuthenticatedUser();
    const document = validVault();
    await createVault(env.DB, actor.ownerId, document);
    const nextPassphrase = validVault().passphrase;
    const results = await Promise.all([
      updatePassphrase(env.DB, actor.ownerId, document.id, 1, nextPassphrase),
      updatePassphrase(env.DB, actor.ownerId, document.id, 1, nextPassphrase),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const updated = results.find(Boolean)!;
    expect(updated.revision).toBe(2);
    expect(updated.document.passphrase).toEqual(nextPassphrase);
    expect(updated.document.keyId).toBe(document.keyId);
    expect(updated.document.recovery).toEqual(document.recovery);
  });

  it("does not update another owner's vault", async () => {
    const own = await seedAuthenticatedUser("own");
    const other = await seedAuthenticatedUser("other");
    const document = validVault();
    await createVault(env.DB, own.ownerId, document);
    expect(
      await updatePassphrase(env.DB, other.ownerId, document.id, 1, validVault().passphrase),
    ).toBeNull();
    expect((await fetchVault(env.DB, own.ownerId, document.id))?.revision).toBe(1);
  });
});
