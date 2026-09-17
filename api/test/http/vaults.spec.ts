import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { validVault } from "../factories/vault";
import { apiRequest, responseJson } from "../helpers/api-client";
import { resetDatabase, seedAuthenticatedUser, seedVault } from "../helpers/seed";

describe("vault HTTP routes", () => {
  beforeEach(resetDatabase);

  it("creates, fetches, and lists the acting user's vault", async () => {
    const actor = await seedAuthenticatedUser();
    const document = validVault();
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: actor.token,
          method: "POST",
          json: document,
        })
      ).status,
    ).toBe(201);
    const fetched = await apiRequest({
      path: `/api/v1/vaults/${document.id}?ownerId=other`,
      token: actor.token,
    });
    expect((await responseJson<{ vault: { document: unknown } }>(fetched)).vault.document).toEqual(
      document,
    );
    const listed = await responseJson<{ vaults: Array<{ document: { id: string } }> }>(
      await apiRequest({ path: "/api/v1/vaults", token: actor.token }),
    );
    expect(listed.vaults.map(({ document: item }) => item.id)).toEqual([document.id]);
  });

  it("returns conflict when the document id or owner uniqueness conflicts", async () => {
    const actor = await seedAuthenticatedUser();
    const other = await seedAuthenticatedUser("other");
    const existing = validVault();
    await seedVault(other.ownerId, existing);
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: actor.token,
          method: "POST",
          json: existing,
        })
      ).status,
    ).toBe(409);
    const own = validVault();
    await seedVault(actor.ownerId, own);
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: actor.token,
          method: "POST",
          json: validVault(),
        })
      ).status,
    ).toBe(409);
  });

  it("hides another owner's vault", async () => {
    const actor = await seedAuthenticatedUser();
    const other = await seedAuthenticatedUser("other");
    const document = validVault();
    await seedVault(other.ownerId, document);
    expect(
      (await apiRequest({ path: `/api/v1/vaults/${document.id}`, token: actor.token })).status,
    ).toBe(404);
  });

  it("updates a passphrase once for the expected revision", async () => {
    const actor = await seedAuthenticatedUser();
    const document = validVault();
    await seedVault(actor.ownerId, document);
    const passphrase = validVault().passphrase;
    const reset = () =>
      apiRequest({
        path: `/api/v1/vaults/${document.id}/passphrase`,
        token: actor.token,
        method: "PUT",
        json: { expectedRevision: 1, passphrase },
      });
    expect((await reset()).status).toBe(200);
    expect((await reset()).status).toBe(409);
    const row = await env.DB.prepare("SELECT revision, document FROM vaults WHERE id = ?")
      .bind(document.id)
      .first<{ revision: number; document: string }>();
    expect(row?.revision).toBe(2);
    expect(JSON.parse(row!.document)).toMatchObject({
      keyId: document.keyId,
      recovery: document.recovery,
      passphrase,
    });
  });

  it("rejects invalid ids and forbidden raw key material", async () => {
    const actor = await seedAuthenticatedUser();
    expect(
      (await apiRequest({ path: "/api/v1/vaults/not-a-uuid", token: actor.token })).status,
    ).toBe(400);
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: actor.token,
          method: "POST",
          json: { ...validVault(), rawKey: "forbidden" },
        })
      ).status,
    ).toBe(400);
  });
});
