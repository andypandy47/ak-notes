import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { importPersonalToken, issueToken, revokeToken } from "../../scripts/tokens.mts";
import { validVault } from "../factories/vault";
import { apiRequest } from "../helpers/api-client";
import { resetDatabase } from "../helpers/seed";

describe("token lifecycle", () => {
  beforeEach(resetDatabase);

  it("imports a personal token idempotently without reviving it", async () => {
    const token = crypto.randomUUID().replaceAll("-", "") + "abcdefghijk";
    const id = await importPersonalToken(env.DB, token);
    expect(await importPersonalToken(env.DB, token)).toBe(id);
    expect((await apiRequest({ path: "/api/v1/vaults", token })).status).toBe(200);
    await revokeToken(env.DB, id);
    await expect(importPersonalToken(env.DB, token)).rejects.toThrow(/revoked/);
    expect((await apiRequest({ path: "/api/v1/vaults", token })).status).toBe(401);
  });

  it("issues distinct tokens for multiple devices of one user", async () => {
    const first = await issueToken(env.DB, { label: "Demo", days: 7 });
    const second = await issueToken(env.DB, { userId: first.userId, label: "Phone" });
    expect(second.userId).toBe(first.userId);
    expect(second.token).not.toBe(first.token);
    expect((await apiRequest({ path: "/api/v1/vaults", token: first.token })).status).toBe(200);
    expect((await apiRequest({ path: "/api/v1/vaults", token: second.token })).status).toBe(200);
    const vault = validVault();
    await apiRequest({ path: "/api/v1/vaults", token: first.token, method: "POST", json: vault });
    expect(
      (await apiRequest({ path: `/api/v1/vaults/${vault.id}`, token: second.token })).status,
    ).toBe(200);
  });

  it("revokes one device without affecting another and is idempotent", async () => {
    const first = await issueToken(env.DB, { label: "Demo" });
    const second = await issueToken(env.DB, { userId: first.userId, label: "Phone" });
    await revokeToken(env.DB, first.id);
    await revokeToken(env.DB, first.id);
    expect((await apiRequest({ path: "/api/v1/vaults", token: first.token })).status).toBe(401);
    expect((await apiRequest({ path: "/api/v1/vaults", token: second.token })).status).toBe(200);
  });

  it("rejects expired credentials", async () => {
    const issued = await issueToken(env.DB, { label: "Expired", days: 1 });
    await env.DB.prepare("UPDATE api_tokens SET created_at = ?, expires_at = ? WHERE id = ?")
      .bind(Date.now() - 2000, Date.now() - 1000, issued.id)
      .run();
    expect((await apiRequest({ path: "/api/v1/vaults", token: issued.token })).status).toBe(401);
  });

  it("validates issue and revoke inputs", async () => {
    await expect(issueToken(env.DB, { userId: "missing", label: "No user" })).rejects.toThrow(
      /User not found/,
    );
    await expect(issueToken(env.DB, { label: "Bad expiry", days: 0 })).rejects.toThrow(/Days/);
    await expect(issueToken(env.DB, { label: "   " })).rejects.toThrow(/label/);
    await expect(revokeToken(env.DB, crypto.randomUUID())).rejects.toThrow(/not found/);
  });

  it("never persists raw token values", async () => {
    const tokens = [
      await issueToken(env.DB, { label: "One" }),
      await issueToken(env.DB, { label: "Two" }),
    ];
    const stored = JSON.stringify((await env.DB.prepare("SELECT * FROM api_tokens").all()).results);
    for (const { token } of tokens) expect(stored).not.toContain(token);
  });

  it("isolates vault access between token owners", async () => {
    const first = await issueToken(env.DB, { label: "First" });
    const second = await issueToken(env.DB, { label: "Second" });
    const firstVault = validVault();
    const secondVault = validVault();
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: first.token,
          method: "POST",
          json: firstVault,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await apiRequest({
          path: "/api/v1/vaults",
          token: second.token,
          method: "POST",
          json: secondVault,
        })
      ).status,
    ).toBe(201);
    expect(
      (await apiRequest({ path: `/api/v1/vaults/${secondVault.id}`, token: first.token })).status,
    ).toBe(404);
    expect(
      (await apiRequest({ path: `/api/v1/vaults/${firstVault.id}`, token: second.token })).status,
    ).toBe(404);
  });
});

it("does not accept an obsolete environment-token fallback", async () => {
  expect((await apiRequest({ path: "/api/v1/vaults", token: "x".repeat(43) })).status).toBe(401);
});
