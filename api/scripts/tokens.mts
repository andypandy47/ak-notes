import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

export async function openLocalDatabase() {
  const { getPlatformProxy } = await import("wrangler");
  return getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
    persist: { path: fileURLToPath(new URL("../.wrangler/state/v3", import.meta.url)) },
    remoteBindings: false,
  });
}

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
  const userId = options.userId ?? randomUUID();
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
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

export async function importPersonalToken(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new Error("The local token file is invalid.");
  }
  const hash = createHash("sha256").update(token).digest("hex");
  const createdAt = Date.now();
  await db
    .prepare(
      "INSERT INTO users (id, name, created_at) VALUES ('personal', 'Personal', ?1) ON CONFLICT(id) DO NOTHING",
    )
    .bind(createdAt)
    .run();
  await db
    .prepare(
      "INSERT INTO api_tokens (id, user_id, label, token_hash, created_at) VALUES (?1, 'personal', 'Personal local token', ?2, ?3) ON CONFLICT(token_hash) DO NOTHING",
    )
    .bind(randomUUID(), hash, createdAt)
    .run();
  const existing = await db
    .prepare(
      "SELECT id FROM api_tokens WHERE token_hash = ?1 AND user_id = 'personal' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?2)",
    )
    .bind(hash, Date.now())
    .first<{ id: string }>();
  if (!existing) {
    throw new Error(
      "This token is revoked, expired, or belongs to another user. Issue a new token for personal; setup will not reactivate it.",
    );
  }
  return existing.id;
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
    },
    allowPositionals: true,
  });
  const [command] = positionals;
  if (positionals.length !== 1 || !["issue", "list", "revoke"].includes(command ?? "")) {
    throw new Error(
      "Usage: npm run tokens -- issue --label demo [--name NAME] [--days 7] [--user USER_ID] | list [--user USER_ID] | revoke --id TOKEN_ID. Local database only.",
    );
  }
  if (
    (command === "issue" && (!values.label || values.id)) ||
    (command === "list" && (values.name || values.label || values.days || values.id)) ||
    (command === "revoke" &&
      (!values.id || values.name || values.label || values.days || values.user))
  ) {
    throw new Error("Invalid command options. Issue needs --label; revoke needs --id.");
  }
  const proxy = await openLocalDatabase();
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
    } else {
      await revokeToken(db, values.id!);
      console.log("Token revoked in the local database.");
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
