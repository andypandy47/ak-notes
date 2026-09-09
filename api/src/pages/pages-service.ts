import { Envelope, type SavePage } from "../types";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { createDb } from "../db/client";
import { pages, vaults } from "../db/schema";
import type { z } from "zod";

type PageRow = {
  id: string;
  revision: number;
  updatedAt: string;
  envelope: z.infer<typeof Envelope>;
};
const decode = (row: PageRow) => ({ ...row, envelope: Envelope.parse(row.envelope) });

export async function fetchPage(db: D1Database, ownerId: string, id: string) {
  const database = createDb(db);
  const ownedVaults = database
    .select({ id: vaults.id })
    .from(vaults)
    .where(eq(vaults.ownerId, ownerId));
  const row = await database
    .select({
      id: pages.id,
      revision: pages.revision,
      updatedAt: pages.updatedAt,
      envelope: pages.envelope,
    })
    .from(pages)
    .where(and(eq(pages.id, id), inArray(pages.vaultId, ownedVaults)))
    .get();
  return row ? decode(row) : null;
}

export async function listPages(db: D1Database, ownerId: string, after: string, limit: number) {
  const database = createDb(db);
  const ownedVaults = database
    .select({ id: vaults.id })
    .from(vaults)
    .where(eq(vaults.ownerId, ownerId));
  const rows = await database
    .select({ id: pages.id, revision: pages.revision, updatedAt: pages.updatedAt })
    .from(pages)
    .where(and(inArray(pages.vaultId, ownedVaults), gt(pages.id, after)))
    .orderBy(pages.id)
    .limit(limit + 1);
  const pageItems = rows.slice(0, limit);
  return { pages: pageItems, nextCursor: rows.length > limit ? pageItems.at(-1)!.id : null };
}

export async function savePage(
  db: D1Database,
  ownerId: string,
  id: string,
  data: z.infer<typeof SavePage>,
) {
  const updatedAt = new Date().toISOString();
  const database = createDb(db);
  const ownedVault = await database
    .select({ id: vaults.id })
    .from(vaults)
    .where(
      and(
        eq(vaults.ownerId, ownerId),
        sql`json_extract(${vaults.document}, '$.keyId') = ${data.envelope.keyId}`,
      ),
    )
    .get();
  if (!ownedVault) return null;

  // The revision condition is part of the write itself, so concurrent requests cannot both win.
  const ownedVaults = database
    .select({ id: vaults.id })
    .from(vaults)
    .where(
      and(
        eq(vaults.ownerId, ownerId),
        sql`json_extract(${vaults.document}, '$.keyId') = ${data.envelope.keyId}`,
      ),
    );
  const rows =
    data.expectedRevision === 0
      ? await database
          .insert(pages)
          .values({ id, vaultId: ownedVault.id, revision: 1, updatedAt, envelope: data.envelope })
          .onConflictDoNothing()
          .returning()
      : await database
          .update(pages)
          .set({
            revision: sql`${pages.revision} + 1`,
            updatedAt,
            envelope: data.envelope,
          })
          .where(
            and(
              eq(pages.id, id),
              eq(pages.revision, data.expectedRevision),
              inArray(pages.vaultId, ownedVaults),
            ),
          )
          .returning();
  const row = rows[0];
  return row ? decode(row) : null;
}
