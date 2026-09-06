import { Envelope, type SavePage } from "../types";
import type { z } from "zod";

type PageRow = { id: string; revision: number; updatedAt: string; envelope: string };
const columns = "id, revision, updated_at AS updatedAt, envelope";
const decode = (row: PageRow) => ({ ...row, envelope: Envelope.parse(JSON.parse(row.envelope)) });

export async function fetchPage(db: D1Database, id: string) {
  const row = await db
    .prepare(`SELECT ${columns} FROM pages WHERE id = ?1`)
    .bind(id)
    .first<PageRow>();
  return row ? decode(row) : null;
}

export async function listPages(db: D1Database, after: string, limit: number) {
  const { results } = await db
    .prepare(
      "SELECT id, revision, updated_at AS updatedAt FROM pages WHERE id > ?1 ORDER BY id LIMIT ?2",
    )
    .bind(after, limit + 1)
    .all<Omit<PageRow, "envelope">>();
  const pages = results.slice(0, limit);
  return { pages, nextCursor: results.length > limit ? pages.at(-1)!.id : null };
}

export async function savePage(db: D1Database, id: string, data: z.infer<typeof SavePage>) {
  const updatedAt = new Date().toISOString();
  const envelope = JSON.stringify(data.envelope);
  // The revision condition is part of the write itself, so concurrent requests cannot both win.
  const statement =
    data.expectedRevision === 0
      ? db
          .prepare(
            `INSERT INTO pages (id, revision, updated_at, envelope) VALUES (?1, 1, ?2, ?3) ON CONFLICT(id) DO NOTHING RETURNING ${columns}`,
          )
          .bind(id, updatedAt, envelope)
      : db
          .prepare(
            `UPDATE pages SET revision = revision + 1, updated_at = ?2, envelope = ?3 WHERE id = ?1 AND revision = ?4 RETURNING ${columns}`,
          )
          .bind(id, updatedAt, envelope, data.expectedRevision);
  const row = await statement.first<PageRow>();
  return row ? decode(row) : null;
}
