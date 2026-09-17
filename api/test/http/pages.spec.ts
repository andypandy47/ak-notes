import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createPageId, createVaultId } from "../../src/ids";
import { validEnvelope, type EnvelopeFixture } from "../factories/envelope";
import { validVault } from "../factories/vault";
import { apiRequest, responseJson } from "../helpers/api-client";
import { resetDatabase, seedAuthenticatedUser, seedPage, seedVault } from "../helpers/seed";

type Actor = { ownerId: string; token: string };
type PageBody = { id: string; revision: number; envelope: EnvelopeFixture };
type PageSummaryBody = {
  id: string;
  revision: number;
  summaryEnvelope: EnvelopeFixture | null;
};

let actor: Actor;
let vault: ReturnType<typeof validVault>;

beforeEach(async () => {
  await resetDatabase();
  actor = await seedAuthenticatedUser();
  vault = validVault();
  await seedVault(actor.ownerId, vault);
});

const savePage = (
  id: string,
  expectedRevision: number,
  envelope = validEnvelope(vault.keyId),
  summaryEnvelope = validEnvelope(vault.keyId),
) =>
  apiRequest({
    path: `/api/v1/pages/${id}`,
    token: actor.token,
    method: "PUT",
    json: { expectedRevision, envelope, summaryEnvelope },
  });

describe("PUT /api/v1/pages/:pageId", () => {
  it("creates an encrypted page and never stores plaintext", async () => {
    const id = createPageId();
    const envelope = validEnvelope(vault.keyId);
    const summaryEnvelope = validEnvelope(vault.keyId);
    const response = await savePage(id, 0, envelope, summaryEnvelope);

    expect(response.status).toBe(201);
    expect((await responseJson<{ page: PageBody }>(response)).page.envelope).toEqual(envelope);
    const rows = await env.DB.prepare("SELECT * FROM pages").all();
    expect(JSON.stringify(rows)).not.toContain("Private title");
    expect(JSON.stringify(rows)).not.toContain("Sensitive content");
  });

  it("rejects a stale revision", async () => {
    const id = createPageId();
    expect((await savePage(id, 0)).status).toBe(201);
    expect((await savePage(id, 0)).status).toBe(409);
  });

  it("allows exactly one concurrent update for a revision", async () => {
    const id = createPageId();
    expect((await savePage(id, 0)).status).toBe(201);
    const responses = await Promise.all([savePage(id, 1), savePage(id, 1)]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
  });

  it("cannot create a page using another owner's vault key", async () => {
    const other = await seedAuthenticatedUser("other-owner");
    const otherVault = validVault();
    await seedVault(other.ownerId, otherVault);
    const response = await savePage(
      createPageId(),
      0,
      validEnvelope(otherVault.keyId),
      validEnvelope(otherVault.keyId),
    );
    expect(response.status).toBe(409);
  });

  it("cannot overwrite another owner's page at any plausible revision", async () => {
    const other = await seedAuthenticatedUser("other-owner");
    const otherVault = validVault();
    await seedVault(other.ownerId, otherVault);
    const pageId = createPageId();
    await seedPage({
      id: pageId,
      vaultId: otherVault.id,
      envelope: validEnvelope(otherVault.keyId),
    });

    expect((await savePage(pageId, 0)).status).toBe(409);
    expect((await savePage(pageId, 1)).status).toBe(409);
  });

  it("rejects mismatched page and summary keys", async () => {
    const response = await savePage(createPageId(), 0, validEnvelope(vault.keyId), validEnvelope());
    expect(response.status).toBe(400);
  });

  it("rejects forbidden ownership and plaintext fields", async () => {
    const id = createPageId();
    const envelope = validEnvelope(vault.keyId);
    for (const extra of [
      { ownerId: "other-owner" },
      { vaultId: createVaultId() },
      { title: "Must not be accepted" },
    ]) {
      const response = await apiRequest({
        path: `/api/v1/pages/${id}`,
        token: actor.token,
        method: "PUT",
        json: { expectedRevision: 0, envelope, summaryEnvelope: envelope, ...extra },
      });
      expect(response.status).toBe(400);
    }
  });

  it("rejects malformed JSON and invalid envelopes", async () => {
    const id = createPageId();
    expect(
      (
        await apiRequest({
          path: `/api/v1/pages/${id}`,
          token: actor.token,
          method: "PUT",
          body: "{",
          headers: { "Content-Type": "application/json" },
        })
      ).status,
    ).toBe(400);
    const envelope = { ...validEnvelope(vault.keyId), nonce: "invalid" };
    expect(
      (
        await apiRequest({
          path: `/api/v1/pages/${id}`,
          token: actor.token,
          method: "PUT",
          json: { expectedRevision: 0, envelope, summaryEnvelope: envelope },
        })
      ).status,
    ).toBe(400);
  });

  it("rejects request bodies larger than one MiB", async () => {
    const response = await apiRequest({
      path: `/api/v1/pages/${createPageId()}`,
      token: actor.token,
      method: "PUT",
      body: "x".repeat(1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });
});

describe("GET /api/v1/pages/:pageId", () => {
  it("returns the encrypted page", async () => {
    const id = createPageId();
    const envelope = validEnvelope(vault.keyId);
    await seedPage({ id, vaultId: vault.id, envelope });
    const response = await apiRequest({ path: `/api/v1/pages/${id}`, token: actor.token });
    expect(response.status).toBe(200);
    expect((await responseJson<{ page: PageBody }>(response)).page.envelope).toEqual(envelope);
  });

  it("hides another owner's page even when identity headers and query parameters are supplied", async () => {
    const other = await seedAuthenticatedUser("other-owner");
    const otherVault = validVault();
    await seedVault(other.ownerId, otherVault);
    const id = createPageId();
    await seedPage({ id, vaultId: otherVault.id, envelope: validEnvelope(otherVault.keyId) });
    const response = await apiRequest({
      path: `/api/v1/pages/${id}?ownerId=other-owner`,
      token: actor.token,
      headers: { "X-Owner-Id": "other-owner" },
    });
    expect(response.status).toBe(404);
  });

  it("distinguishes invalid identifiers from missing pages", async () => {
    expect(
      (await apiRequest({ path: "/api/v1/pages/not-a-uuid", token: actor.token })).status,
    ).toBe(400);
    expect(
      (await apiRequest({ path: `/api/v1/pages/${createPageId()}`, token: actor.token })).status,
    ).toBe(404);
  });
});

describe("GET /api/v1/pages", () => {
  it("returns summaries without full encrypted page bodies", async () => {
    const id = createPageId();
    const summaryEnvelope = validEnvelope(vault.keyId);
    await seedPage({
      id,
      vaultId: vault.id,
      envelope: validEnvelope(vault.keyId),
      summaryEnvelope,
    });
    const response = await apiRequest({ path: "/api/v1/pages", token: actor.token });
    const body = await responseJson<{ pages: PageSummaryBody[] }>(response);
    expect(body.pages).toHaveLength(1);
    expect(body.pages[0]?.summaryEnvelope).toEqual(summaryEnvelope);
    expect(body.pages[0]).not.toHaveProperty("envelope");
  });

  it("returns all page summaries", async () => {
    const ids = [createPageId(), createPageId()];
    for (const id of ids) {
      await seedPage({ id, vaultId: vault.id, envelope: validEnvelope(vault.keyId) });
    }
    const response = await apiRequest({ path: "/api/v1/pages", token: actor.token });
    const body = await responseJson<{ pages: PageSummaryBody[] }>(response);
    expect(body.pages.map(({ id }) => id)).toEqual(ids.sort());
  });
});
