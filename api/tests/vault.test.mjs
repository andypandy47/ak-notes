import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createHash, randomBytes } from "node:crypto";

async function bundle(entryPoint, platform) {
  return (
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: "esm",
      platform,
      target: "es2024",
    })
  ).outputFiles[0].text;
}
const client = await import(
  "data:text/javascript;base64," +
    Buffer.from(await bundle("../app/src/features/vault/crypto.ts", "browser")).toString("base64")
);
const worker = await bundle("src/index.ts", "browser");
const password = "test only: twelve quiet mountains";
const nextPassword = "test only: another quiet mountain";
const bytes = new TextEncoder().encode("Private page content");

await test("vault keys survive storage and restart; recovery preserves the encryption key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aknotes-vault-test-"));
  const token = randomBytes(32).toString("base64url");
  const options = convertV4MiniflareOptions({
    modules: true,
    script: worker,
    compatibilityDate: "2026-09-03",
    d1Databases: ["DB"],
    resourcePersistencePath: directory,
  });
  let runtime = new Miniflare(options);
  const request = (suffix = "", init = {}) =>
    runtime.dispatchFetch("http://localhost/api/v1/vaults" + suffix, {
      ...init,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  try {
    const db = await runtime.getD1Database("DB");
    await db.exec(
      (await readFile("migrations/0000_initial.sql", "utf8"))
        .replaceAll("--> statement-breakpoint", "")
        .replaceAll("\n", " "),
    );
    await db
      .prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)")
      .bind("personal", "Personal", Date.now())
      .run();
    await db
      .prepare(
        "INSERT INTO api_tokens (id, user_id, label, token_hash, created_at) VALUES (?, 'personal', 'test', ?, ?)",
      )
      .bind(crypto.randomUUID(), createHash("sha256").update(token).digest("hex"), Date.now())
      .run();
    assert.deepEqual((await (await request()).json()).vaults, []);
    assert.equal((await request("", { headers: { Authorization: "" } })).status, 401);
    const created = await client.createVault(password);
    assert.equal(created.key.extractable, false);
    const iv = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, created.key, bytes);
    const create = () => request("", { method: "POST", body: JSON.stringify(created.document) });
    const results = await Promise.all([create(), create()]);
    assert.deepEqual(
      results.map((r) => r.status).sort((a, b) => a - b),
      [201, 409],
    );
    const stored = (await (await request("/" + created.document.id)).json()).vault;
    assert.deepEqual(stored.document, created.document);
    const serialized = JSON.stringify(await db.prepare("SELECT * FROM vaults").all());
    assert.ok(!serialized.includes(password));
    assert.ok(!serialized.includes(created.recoveryKey));
    assert.ok(!serialized.includes("Private page content"));
    await runtime.dispose();
    runtime = new Miniflare(options);
    const restored = (await (await request("/" + created.document.id)).json()).vault;
    const key = await client.unlockVault(restored.document, password);
    assert.equal(key.extractable, false);
    assert.deepEqual(
      new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted)),
      bytes,
    );
    await assert.rejects(client.unlockVault(restored.document, "incorrect password"));
    const recovered = await client.recoverVault(
      restored.document,
      created.recoveryKey,
      nextPassword,
    );
    const reset = () =>
      request("/" + created.document.id + "/passphrase", {
        method: "PUT",
        body: JSON.stringify({
          expectedRevision: restored.revision,
          passphrase: recovered.passphrase,
        }),
      });
    assert.equal((await reset()).status, 200);
    assert.equal((await reset()).status, 409);
    const updated = (await (await request("/" + created.document.id)).json()).vault;
    assert.equal(updated.revision, 2);
    assert.equal(updated.document.keyId, created.document.keyId);
    assert.deepEqual(updated.document.recovery, created.document.recovery);
    await assert.rejects(client.unlockVault(updated.document, password));
    const newKey = await client.unlockVault(updated.document, nextPassword);
    assert.deepEqual(
      new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, newKey, encrypted)),
      bytes,
    );
    const recoverAgain = await client.recoverVault(updated.document, created.recoveryKey, password);
    assert.deepEqual(
      new Uint8Array(
        await crypto.subtle.decrypt({ name: "AES-GCM", iv }, recoverAgain.key, encrypted),
      ),
      bytes,
    );
    assert.equal(
      (
        await request("", {
          method: "POST",
          body: JSON.stringify({ ...created.document, rawKey: "forbidden" }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/" + created.document.id + "/passphrase", {
          method: "PUT",
          body: JSON.stringify({
            expectedRevision: 2,
            passphrase: { ...recovered.passphrase, iterations: 1 },
          }),
        })
      ).status,
      400,
    );
    const spec = await (await runtime.dispatchFetch("http://localhost/openapi.json")).json();
    for (const [path, method] of [
      ["/api/v1/vaults", "get"],
      ["/api/v1/vaults", "post"],
      ["/api/v1/vaults/{vaultId}", "get"],
      ["/api/v1/vaults/{vaultId}/passphrase", "put"],
    ]) {
      assert.deepEqual(spec.paths[path][method].security, [{ bearerAuth: [] }]);
    }
    assert.ok(!spec.paths["/api/v1/vault"]);
    assert.ok(!spec.paths["/api/v1/vault/passphrase"]);
    const parameters = spec.paths["/api/v1/vaults/{vaultId}/passphrase"].put.parameters;
    assert.ok(
      parameters.some(
        (parameter) =>
          parameter.name === "vaultId" && parameter.in === "path" && parameter.required,
      ),
    );
  } finally {
    await runtime.dispose();
    // Only remove the unique directory this test created directly beneath the OS temp directory.
    assert.equal(
      dirname(await realpath(directory)),
      await realpath(tmpdir()),
      "Unexpected test directory",
    );
    await rm(directory, { recursive: true, force: true });
  }
});

await test("vault cryptography rejects tampering, substituted identities, wrong keys and unsupported KDFs", async () => {
  const created = await client.createVault(password);
  const another = await client.createVault(password);
  assert.notEqual(created.document.passphrase.salt, another.document.passphrase.salt);
  assert.notEqual(created.document.recovery.nonce, another.document.recovery.nonce);
  assert.notEqual(created.recoveryKey, another.recoveryKey);
  await assert.rejects(client.createVault("too short"));
  await assert.rejects(client.recoverVault(created.document, another.recoveryKey, password));
  const tampered = structuredClone(created.document);
  const cipher = tampered.passphrase.wrappedKey.ciphertext;
  tampered.passphrase.wrappedKey.ciphertext = (cipher[0] === "A" ? "B" : "A") + cipher.slice(1);
  await assert.rejects(client.unlockVault(tampered, password));
  await assert.rejects(
    client.unlockVault({ ...created.document, id: crypto.randomUUID() }, password),
  );
  await assert.rejects(
    client.unlockVault({ ...created.document, keyId: crypto.randomUUID() }, password),
  );
  await assert.rejects(
    client.unlockVault(
      { ...created.document, passphrase: { ...created.document.passphrase, iterations: 1 } },
      password,
    ),
  );
  await assert.rejects(client.unlockVault({ ...created.document, version: 2 }, password));
  const swapped = { ...created.document, recovery: created.document.passphrase.wrappedKey };
  await assert.rejects(client.recoverVault(swapped, created.recoveryKey, password));
});
