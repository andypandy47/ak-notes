import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { issueToken, revokeToken, importPersonalToken } from "../scripts/tokens.mts";

const bundle = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2024",
});

await test("issued tokens isolate users, support devices, expire and revoke without fallback", async () => {
  const legacyToken = randomBytes(32).toString("base64url");
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: "2026-09-03",
      d1Databases: ["DB"],
      // An obsolete environment hash must never bypass database revocation.
      bindings: { API_TOKEN_SHA256: createHash("sha256").update(legacyToken).digest("hex") },
    }),
  );
  try {
    const db = await runtime.getD1Database("DB");
    for (const migration of (await readdir("migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await db.exec(
        (await readFile("migrations/" + migration, "utf8"))
          .replaceAll("--> statement-breakpoint", "")
          .replaceAll("\n", " "),
      );
    }
    const request = (token, path = "/vaults", method = "GET", body) =>
      runtime.dispatchFetch("http://localhost/api/v1" + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "X-Owner-Id": "personal",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    assert.equal((await request(legacyToken)).status, 401);
    assert.equal((await request("invalid")).status, 401);
    const personalId = await importPersonalToken(db, legacyToken);
    assert.equal(await importPersonalToken(db, legacyToken), personalId);
    assert.equal((await request(legacyToken)).status, 200);
    const demo = await issueToken(db, { label: "Demo", days: 7 });
    assert.notEqual(demo.userId, "personal");
    assert.equal((await request(demo.token)).status, 200);
    assert.deepEqual((await (await request(demo.token)).json()).vaults, []);
    const secondDevice = await issueToken(db, { userId: demo.userId, label: "Demo phone" });
    assert.equal(secondDevice.userId, demo.userId);
    assert.notEqual(secondDevice.token, demo.token);
    await assert.rejects(issueToken(db, { userId: "missing", label: "No user" }), /User not found/);
    await assert.rejects(issueToken(db, { label: "Bad expiry", days: 0 }), /Days/);
    await assert.rejects(issueToken(db, { label: "   " }), /label/);
    const wrapped = () => ({
      nonce: randomBytes(12).toString("base64"),
      ciphertext: randomBytes(48).toString("base64"),
    });
    const vault = () => ({
      version: 1,
      id: crypto.randomUUID(),
      keyId: crypto.randomUUID(),
      algorithm: "AES-256-GCM",
      passphrase: {
        kdf: "PBKDF2-SHA-256",
        iterations: 600000,
        salt: randomBytes(16).toString("base64"),
        wrappedKey: wrapped(),
      },
      recovery: wrapped(),
    });
    const personalVault = vault();
    const demoVault = vault();
    assert.equal((await request(legacyToken, "/vaults", "POST", personalVault)).status, 201);
    assert.equal((await request(demo.token, "/vaults", "POST", personalVault)).status, 409);
    assert.equal((await request(demo.token, "/vaults", "POST", demoVault)).status, 201);
    for (const { ownToken, ownVault, otherVault } of [
      { ownToken: legacyToken, ownVault: personalVault, otherVault: demoVault },
      { ownToken: demo.token, ownVault: demoVault, otherVault: personalVault },
    ]) {
      assert.deepEqual(
        (await (await request(ownToken, "/vaults?ownerId=personal")).json()).vaults.map(
          (item) => item.document.id,
        ),
        [ownVault.id],
      );
      assert.equal((await request(ownToken, "/vaults/" + ownVault.id)).status, 200);
      assert.equal((await request(ownToken, "/vaults/" + otherVault.id)).status, 404);
      assert.equal(
        (
          await request(ownToken, "/vaults/" + otherVault.id + "/passphrase", "PUT", {
            expectedRevision: 1,
            passphrase: ownVault.passphrase,
          })
        ).status,
        409,
      );
    }
    const personalPageId = crypto.randomUUID();
    const demoPageId = crypto.randomUUID();
    const envelope = (keyId) => ({
      version: 1,
      algorithm: "AES-256-GCM",
      keyId,
      nonce: randomBytes(12).toString("base64"),
      ciphertext: randomBytes(32).toString("base64"),
    });
    const personalPage = { expectedRevision: 0, envelope: envelope(personalVault.keyId) };
    const demoPage = { expectedRevision: 0, envelope: envelope(demoVault.keyId) };
    assert.equal(
      (await request(legacyToken, "/pages/" + personalPageId, "PUT", personalPage)).status,
      201,
    );
    assert.equal((await request(demo.token, "/pages/" + demoPageId, "PUT", demoPage)).status, 201);
    for (const { ownToken, ownPageId, otherPageId, ownPage } of [
      {
        ownToken: legacyToken,
        ownPageId: personalPageId,
        otherPageId: demoPageId,
        ownPage: personalPage,
      },
      {
        ownToken: demo.token,
        ownPageId: demoPageId,
        otherPageId: personalPageId,
        ownPage: demoPage,
      },
    ]) {
      assert.deepEqual(
        (await (await request(ownToken, "/pages")).json()).pages.map((item) => item.id),
        [ownPageId],
      );
      assert.equal((await request(ownToken, "/pages/" + otherPageId)).status, 404);
      for (const expectedRevision of [0, 1]) {
        assert.equal(
          (
            await request(ownToken, "/pages/" + otherPageId, "PUT", {
              ...ownPage,
              expectedRevision,
            })
          ).status,
          409,
        );
      }
      assert.equal(
        (await (await request(ownToken, "/pages/" + ownPageId)).json()).page.revision,
        1,
      );
    }
    assert.equal((await request(secondDevice.token, "/pages/" + demoPageId)).status, 200);
    await revokeToken(db, demo.id);
    await revokeToken(db, demo.id);
    assert.equal((await request(demo.token)).status, 401);
    assert.equal(
      (
        await request(demo.token, "/pages/" + demoPageId, "PUT", {
          ...demoPage,
          expectedRevision: 1,
        })
      ).status,
      401,
    );
    assert.equal((await request(secondDevice.token)).status, 200);
    assert.equal((await request(legacyToken)).status, 200);
    await assert.rejects(revokeToken(db, crypto.randomUUID()), /not found/);
    const expired = await issueToken(db, { userId: demo.userId, label: "Expired", days: 1 });
    await db
      .prepare("UPDATE api_tokens SET created_at = ?1, expires_at = ?2 WHERE id = ?3")
      .bind(Date.now() - 2000, Date.now() - 1000, expired.id)
      .run();
    assert.equal((await request(expired.token)).status, 401);
    await revokeToken(db, personalId);
    assert.equal((await request(legacyToken)).status, 401);
    await assert.rejects(importPersonalToken(db, legacyToken), /revoked/);
    assert.equal((await request(legacyToken)).status, 401);
    const tokens = JSON.stringify((await db.prepare("SELECT * FROM api_tokens").all()).results);
    for (const token of [legacyToken, demo.token, secondDevice.token, expired.token]) {
      assert.ok(!tokens.includes(token));
    }
    const recoveryToken = await issueToken(db, { userId: "personal", label: "Replacement" });
    assert.equal((await request(recoveryToken.token, "/vaults/" + personalVault.id)).status, 200);
  } finally {
    await runtime.dispose();
  }
});
