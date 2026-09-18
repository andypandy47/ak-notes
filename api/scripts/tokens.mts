import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { createApiTokenId, createUserId } from "../src/ids.ts";

type DatabaseTarget = { remote?: boolean; environment?: string };

export async function openDatabase({ remote = false, environment }: DatabaseTarget = {}) {
  if (!remote && environment !== undefined) {
    throw new Error("--env can only be used with --remote.");
  }
  const { getPlatformProxy } = await import("wrangler");
  return getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
    ...(remote
      ? { environment: environment ?? "production", remoteBindings: true }
      : {
          persist: { path: fileURLToPath(new URL("../.wrangler/state/v3", import.meta.url)) },
          remoteBindings: false,
        }),
  });
}

export const openLocalDatabase = () => openDatabase();

export async function issueToken(
  db: D1Database,
  options: { userId?: string; name?: string; label: string; days?: number },
) {
  if (!options.label.trim() || options.label.length > 100) {
    throw new Error("Provide a label between 1 and 100 characters.");
  }
  if (
    options.days !== undefined &&
    (!Number.isInteger(options.days) || options.days < 1 || options.days > 3650)
  ) {
    throw new Error("Days must be an integer between 1 and 3650.");
  }
  if (
    options.userId !== undefined &&
    !(await db.prepare("SELECT id FROM users WHERE id = ?1").bind(options.userId).first())
  ) {
    throw new Error("User not found. Omit --user to create a new user.");
  }
  const userId = options.userId ?? createUserId();
  const token = randomBytes(32).toString("base64url");
  const id = createApiTokenId();
  const createdAt = Date.now();
  const expiresAt = options.days === undefined ? null : createdAt + options.days * 86400000;
  const statements = [];
  if (options.userId === undefined) {
    const name = options.name?.trim() || options.label.trim();
    if (name.length > 100) {
      throw new Error("Provide a user name between 1 and 100 characters.");
    }
    statements.push(
      db
        .prepare("INSERT INTO users (id, name, created_at) VALUES (?1, ?2, ?3)")
        .bind(userId, name, createdAt),
    );
  }
  statements.push(
    db
      .prepare(
        "INSERT INTO api_tokens (id, user_id, label, token_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      )
      .bind(
        id,
        userId,
        options.label.trim(),
        createHash("sha256").update(token).digest("hex"),
        createdAt,
        expiresAt,
      ),
  );
  await db.batch(statements);
  return { id, userId, label: options.label.trim(), expiresAt, token };
}

export async function importPersonalToken(
  db: D1Database,
  token: string,
  label = "Personal local token",
) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new Error("The token file is invalid.");
  }
  const hash = createHash("sha256").update(token).digest("hex");
  const createdAt = Date.now();
  const existing = await db
    .prepare("SELECT id, revoked_at, expires_at FROM api_tokens WHERE token_hash = ?1")
    .bind(hash)
    .first<{ id: string; revoked_at: number | null; expires_at: number | null }>();
  if (existing) {
    if (
      existing.revoked_at !== null ||
      (existing.expires_at !== null && existing.expires_at <= createdAt)
    ) {
      throw new Error(
        "This token is revoked or expired. Issue a new token; setup will not reactivate it.",
      );
    }
    return existing.id;
  }

  const userId = createUserId();
  const id = createApiTokenId();
  const results = await db.batch([
    db
      .prepare("INSERT INTO users (id, name, created_at) VALUES (?1, 'Personal', ?2)")
      .bind(userId, createdAt),
    db
      .prepare(
        "INSERT INTO api_tokens (id, user_id, label, token_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      )
      .bind(id, userId, label, hash, createdAt),
  ]);
  if (results.some((result) => !result.success)) {
    throw new Error("Could not import the personal token.");
  }
  return id;
}

export async function revokeToken(db: D1Database, id: string) {
  const row = await db
    .prepare(
      "UPDATE api_tokens SET revoked_at = COALESCE(revoked_at, ?2) WHERE id = ?1 RETURNING id",
    )
    .bind(id, Date.now())
    .first();
  if (!row) {
    throw new Error("Token ID not found.");
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      user: { type: "string" },
      name: { type: "string" },
      label: { type: "string" },
      days: { type: "string" },
      id: { type: "string" },
      remote: { type: "boolean" },
      env: { type: "string" },
      "token-file": { type: "string" },
    },
    allowPositionals: true,
  });
  const [command] = positionals;
  if (positionals.length !== 1 || !["issue", "list", "revoke", "import"].includes(command ?? "")) {
    throw new Error(
      "Usage: npm run tokens -- <issue|list|revoke|import> [options] [--remote --env production]. Import requires --token-file PATH.",
    );
  }
  if (
    (command === "issue" && (!values.label || values.id || values["token-file"])) ||
    (command === "list" &&
      (values.name || values.label || values.days || values.id || values["token-file"])) ||
    (command === "revoke" &&
      (!values.id ||
        values.name ||
        values.label ||
        values.days ||
        values.user ||
        values["token-file"])) ||
    (command === "import" &&
      (!values["token-file"] ||
        values.id ||
        values.name ||
        values.label ||
        values.days ||
        values.user)) ||
    (!values.remote && values.env)
  ) {
    throw new Error(
      "Invalid command options. Issue needs --label; revoke needs --id; import needs --token-file; --env needs --remote.",
    );
  }
  const target = values.remote ? `remote ${values.env ?? "production"}` : "local";
  const proxy = await openDatabase({ remote: values.remote, environment: values.env });
  try {
    const db = proxy.env.DB;
    if (command === "issue") {
      const issued = await issueToken(db, {
        userId: values.user,
        name: values.name,
        label: values.label!,
        days: values.days === undefined ? undefined : Number(values.days),
      });
      console.log("Save this token now; only its hash is stored in the local database.");
      console.log(JSON.stringify(issued, null, 2));
    } else if (command === "list") {
      const { results } = await db
        .prepare(
          "SELECT id, user_id, label, created_at, expires_at, revoked_at FROM api_tokens WHERE (?1 IS NULL OR user_id = ?1) ORDER BY created_at, id",
        )
        .bind(values.user ?? null)
        .all();
      console.log(JSON.stringify(results, null, 2));
    } else if (command === "revoke") {
      await revokeToken(db, values.id!);
      console.log(`Token revoked in the ${target} database.`);
    } else {
      const token = readFileSync(values["token-file"]!, "utf8").trim();
      const id = await importPersonalToken(db, token, "Personal imported token");
      console.log(`Token imported into the ${target} database (${id}). Its value was not printed.`);
    }
  } finally {
    await proxy.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Token command failed.");
    process.exitCode = 1;
  });
}
