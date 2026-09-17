import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createPageId } from "../../src/ids";
import { fetchPage, listPages, savePage } from "../../src/pages/pages-service";
import { validEnvelope } from "../factories/envelope";
import { validVault } from "../factories/vault";
import { resetDatabase, seedAuthenticatedUser, seedPage, seedVault } from "../helpers/seed";

describe("page service ownership and concurrency", () => {
  beforeEach(resetDatabase);

  it("fetches and lists only pages owned by the requested tenant", async () => {
    const own = await seedAuthenticatedUser("own");
    const other = await seedAuthenticatedUser("other");
    const ownVault = validVault();
    const otherVault = validVault();
    await seedVault(own.ownerId, ownVault);
    await seedVault(other.ownerId, otherVault);
    const ownId = createPageId();
    const otherId = createPageId();
    await seedPage({ id: ownId, vaultId: ownVault.id, envelope: validEnvelope(ownVault.keyId) });
    await seedPage({
      id: otherId,
      vaultId: otherVault.id,
      envelope: validEnvelope(otherVault.keyId),
    });

    expect((await fetchPage(env.DB, own.ownerId, ownId))?.id).toBe(ownId);
    expect(await fetchPage(env.DB, own.ownerId, otherId)).toBeNull();
    expect((await listPages(env.DB, own.ownerId)).map(({ id }) => id)).toEqual([ownId]);
  });

  it("returns every page in stable ID order", async () => {
    const actor = await seedAuthenticatedUser();
    const vault = validVault();
    await seedVault(actor.ownerId, vault);
    const ids = [createPageId(), createPageId(), createPageId()].sort();
    for (const id of ids)
      await seedPage({ id, vaultId: vault.id, envelope: validEnvelope(vault.keyId) });

    expect((await listPages(env.DB, actor.ownerId)).map(({ id }) => id)).toEqual(ids);
  });

  it("performs revision checks atomically", async () => {
    const actor = await seedAuthenticatedUser();
    const vault = validVault();
    await seedVault(actor.ownerId, vault);
    const id = createPageId();
    const input = {
      expectedRevision: 0,
      envelope: validEnvelope(vault.keyId),
      summaryEnvelope: validEnvelope(vault.keyId),
    };
    expect((await savePage(env.DB, actor.ownerId, id, input))?.revision).toBe(1);
    const update = { ...input, expectedRevision: 1 };
    const results = await Promise.all([
      savePage(env.DB, actor.ownerId, id, update),
      savePage(env.DB, actor.ownerId, id, update),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)?.revision).toBe(2);
  });
});
