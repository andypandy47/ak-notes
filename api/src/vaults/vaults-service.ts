import { VaultRecord, VaultDocument, PassphraseKey } from "../types";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../db/client";
import { vaults } from "../db/schema";

type Row = { revision: number; document: VaultDocument };
const decode = (row: Row) => VaultRecord.parse(row);

export async function fetchVault(db: D1Database, ownerId: string, vaultId: string) {
  const row = await createDb(db)
    .select({ revision: vaults.revision, document: vaults.document })
    .from(vaults)
    .where(and(eq(vaults.ownerId, ownerId), eq(vaults.id, vaultId)))
    .get();
  return row ? decode(row) : null;
}

export async function createVault(db: D1Database, ownerId: string, document: VaultDocument) {
  const [row] = await createDb(db)
    .insert(vaults)
    .values({ id: document.id, ownerId, revision: 1, document })
    .onConflictDoNothing()
    .returning({ revision: vaults.revision, document: vaults.document });
  return row ? decode(row) : null;
}

export async function updatePassphrase(
  db: D1Database,
  ownerId: string,
  vaultId: string,
  expectedRevision: number,
  passphrase: PassphraseKey,
) {
  // Only replace the passphrase wrapper. Recovery material and vault identity remain intact.
  const [row] = await createDb(db)
    .update(vaults)
    .set({
      revision: sql`${vaults.revision} + 1`,
      document: sql`json_set(${vaults.document}, '$.passphrase', json(${JSON.stringify(passphrase)}))`,
    })
    .where(
      and(
        eq(vaults.ownerId, ownerId),
        eq(vaults.revision, expectedRevision),
        eq(vaults.id, vaultId),
      ),
    )
    .returning({ revision: vaults.revision, document: vaults.document });
  return row ? decode(row) : null;
}

export async function listVaults(db: D1Database, ownerId: string) {
  const results = await createDb(db)
    .select({ revision: vaults.revision, document: vaults.document })
    .from(vaults)
    .where(eq(vaults.ownerId, ownerId))
    .orderBy(vaults.id);
  return results.map(decode);
}
