import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createPageId } from "../../src/ids";
import { issueToken } from "../../scripts/tokens.mts";
import { validEnvelope } from "../factories/envelope";
import { validVault } from "../factories/vault";
import { apiRequest, responseJson } from "../helpers/api-client";
import { resetDatabase } from "../helpers/seed";

describe("tenant-isolation integration", () => {
  beforeEach(resetDatabase);

  it("isolates vaults and pages throughout a multi-user journey", async () => {
    const actor = await issueToken(env.DB, { label: "Laptop" });
    const other = await issueToken(env.DB, { label: "Other" });
    const vault = validVault();
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: actor.token,
          method: "POST",
          json: vault,
        })
      ).status,
    ).toBe(201);
    expect(
      (await apiRequest({ path: `/api/v1/vaults/${vault.id}`, token: other.token })).status,
    ).toBe(404);
    const pageId = createPageId();
    const envelope = validEnvelope(vault.keyId);
    const summaryEnvelope = validEnvelope(vault.keyId);
    expect(
      (
        await apiRequest({
          path: `/api/v1/pages/${pageId}`,
          token: actor.token,
          method: "PUT",
          json: { expectedRevision: 0, envelope, summaryEnvelope },
        })
      ).status,
    ).toBe(201);
    expect((await apiRequest({ path: `/api/v1/pages/${pageId}`, token: other.token })).status).toBe(
      404,
    );
    expect(
      (
        await responseJson<{ page: { envelope: unknown } }>(
          await apiRequest({ path: `/api/v1/pages/${pageId}`, token: actor.token }),
        )
      ).page.envelope,
    ).toEqual(envelope);
  });
});
