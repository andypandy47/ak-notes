import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("D1 migrations", () => {
  it("builds the complete schema from an empty isolated database", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_METADATA' ORDER BY name",
    ).all<{ name: string }>();
    expect(tables.results.map(({ name }) => name)).toEqual([
      "api_tokens",
      "d1_migrations",
      "pages",
      "users",
      "vaults",
    ]);

    const pageColumns = await env.DB.prepare("PRAGMA table_info(pages)").all<{ name: string }>();
    expect(pageColumns.results.map(({ name }) => name)).toContain("summary_envelope");
    const migrations = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{
      name: string;
    }>();
    expect(migrations.results.map(({ name }) => name)).toEqual([
      "0000_initial.sql",
      "0001_add_page_summaries.sql",
      "0002_prefixed_ulids.sql",
    ]);
  });

  it("enforces prefixed ULIDs at the database boundary", async () => {
    await expect(
      env.DB.prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)")
        .bind("personal", "Personal", Date.now())
        .run(),
    ).rejects.toThrow(/users_id_valid/);
  });
});
