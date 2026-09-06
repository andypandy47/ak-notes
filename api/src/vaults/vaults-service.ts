import { VaultRecord, VaultDocument, PassphraseKey } from "../types";

type Row = { revision: number; document: string };
const decode = (row: Row) =>
  VaultRecord.parse({ revision: row.revision, document: JSON.parse(row.document) });

export async function fetchVault(db: D1Database) {
  const row = await db
    .prepare("SELECT revision, document FROM vault WHERE singleton = 1")
    .first<Row>();
  return row ? decode(row) : null;
}

export async function createVault(db: D1Database, document: VaultDocument) {
  const row = await db
    .prepare(
      "INSERT INTO vault (singleton, revision, document) VALUES (1, 1, ?1) ON CONFLICT(singleton) DO NOTHING RETURNING revision, document",
    )
    .bind(JSON.stringify(document))
    .first<Row>();
  return row ? decode(row) : null;
}

export async function updatePassphrase(
  db: D1Database,
  expectedRevision: number,
  passphrase: PassphraseKey,
) {
  // Only replace the passphrase wrapper. Recovery material and vault identity remain intact.
  const row = await db
    .prepare(
      "UPDATE vault SET revision = revision + 1, document = json_set(document, '$.passphrase', json(?1)) WHERE singleton = 1 AND revision = ?2 RETURNING revision, document",
    )
    .bind(JSON.stringify(passphrase), expectedRevision)
    .first<Row>();
  return row ? decode(row) : null;
}
