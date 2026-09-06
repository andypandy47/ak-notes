import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createHash, randomBytes } from "node:crypto";

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const bundle = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2024",
});
const script = bundle.outputFiles[0].text;
const createRuntime = (bindings = {}) =>
  new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script,
      compatibilityDate: "2026-09-03",
      d1Databases: ["DB"],
      bindings,
    }),
  );

await test("encrypted page API, validation, authorization and OpenAPI", async () => {
  const runtime = createRuntime({ API_TOKEN_SHA256: tokenHash });
  try {
    const db = await runtime.getD1Database("DB");
    await db.exec((await readFile("migrations/0001_pages.sql", "utf8")).replaceAll("\n", " "));
    const request = (path, options = {}) =>
      runtime.dispatchFetch("http://localhost" + path, {
        ...options,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    const id = crypto.randomUUID();
    const keyId = crypto.randomUUID();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const plaintext = JSON.stringify({
      title: "Private title",
      blocks: [{ type: "paragraph", content: "Sensitive content" }],
    });
    const aad = new TextEncoder().encode(JSON.stringify(["aknotes-page", 1, id, 1, keyId]));
    const nonce = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad, tagLength: 128 },
      key,
      new TextEncoder().encode(plaintext),
    );
    const envelope = {
      version: 1,
      algorithm: "AES-256-GCM",
      keyId,
      nonce: nonce.toString("base64"),
      ciphertext: Buffer.from(encrypted).toString("base64"),
    };
    const save = (expectedRevision, extra = {}) =>
      request("/api/v1/pages/" + id, {
        method: "PUT",
        body: JSON.stringify({ expectedRevision, envelope, ...extra }),
      });
    assert.equal((await request("/api/v1/pages", { headers: { Authorization: "" } })).status, 401);
    assert.equal(
      (
        await request("/api/v1/pages", {
          headers: { Authorization: "Bearer " + randomBytes(32).toString("base64url") },
        })
      ).status,
      401,
    );
    assert.equal((await save(0, { title: "Must not be accepted" })).status, 400);
    assert.equal((await request("/api/v1/pages/" + id, { method: "PUT", body: "{" })).status, 400);
    assert.equal(
      (
        await request("/api/v1/pages/" + id, {
          method: "PUT",
          body: JSON.stringify({
            expectedRevision: 0,
            envelope: { ...envelope, nonce: "invalid" },
          }),
        })
      ).status,
      400,
    );
    assert.equal((await save(0)).status, 201);
    assert.equal((await save(0)).status, 409);
    const stored = (await (await request("/api/v1/pages/" + id)).json()).page;
    assert.deepEqual(stored.envelope, envelope);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(stored.envelope.nonce, "base64"),
        additionalData: aad,
        tagLength: 128,
      },
      key,
      Buffer.from(stored.envelope.ciphertext, "base64"),
    );
    assert.equal(new TextDecoder().decode(decrypted), plaintext);
    const rows = await db.prepare("SELECT * FROM pages").all();
    assert.ok(!JSON.stringify(rows).includes("Private title"));
    assert.ok(!JSON.stringify(rows).includes("Sensitive content"));
    const concurrent = await Promise.all([save(1), save(1)]);
    assert.deepEqual(
      concurrent.map((r) => r.status).sort((a, b) => a - b),
      [200, 409],
    );
    assert.equal((await save(1)).status, 409);
    assert.equal((await request("/api/v1/pages/" + crypto.randomUUID())).status, 404);
    assert.equal((await request("/api/v1/pages/not-a-uuid")).status, 400);
    assert.equal((await request("/api/v1/pages?limit=101")).status, 400);
    const secondId = crypto.randomUUID();
    assert.equal(
      (
        await request("/api/v1/pages/" + secondId, {
          method: "PUT",
          body: JSON.stringify({ expectedRevision: 0, envelope }),
        })
      ).status,
      201,
    );
    const first = await (await request("/api/v1/pages?limit=1")).json();
    assert.equal(first.pages.length, 1);
    assert.ok(first.nextCursor);
    assert.ok(!("envelope" in first.pages[0]));
    const second = await (await request("/api/v1/pages?limit=1&after=" + first.nextCursor)).json();
    assert.equal(second.pages.length, 1);
    assert.equal(second.nextCursor, null);
    assert.notEqual(first.pages[0].id, second.pages[0].id);
    assert.equal(
      (await request("/api/v1/pages/" + id, { method: "PUT", body: "x".repeat(1024 * 1024 + 1) }))
        .status,
      413,
    );
    const spec = await (await request("/openapi.json")).json();
    assert.equal(spec.info.title, "AK Notes API");
    assert.ok(spec.paths["/api/v1/pages/{pageId}"].put);
    assert.deepEqual(spec.paths["/api/v1/pages/{pageId}"].put.security, [{ bearerAuth: [] }]);
    assert.equal(spec.components.securitySchemes.bearerAuth.scheme, "bearer");
    assert.ok(!JSON.stringify(spec.paths).includes("/api/tasks"));
  } finally {
    await runtime.dispose();
  }
});

await test("unconfigured authentication fails closed", async () => {
  const runtime = createRuntime();
  try {
    assert.equal((await runtime.dispatchFetch("http://localhost/api/v1/pages")).status, 503);
  } finally {
    await runtime.dispose();
  }
});
