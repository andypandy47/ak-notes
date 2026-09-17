import { getLocalDatabase } from "@/lib/local-database";
import { PageEnvelope } from "@/types/encrypted-page";
import { z } from "zod";
import {
  decryptPageEnvelope,
  decryptPageSummaryEnvelope,
  encryptPage,
  encryptPageSummary,
} from "../crypto";
import type { Page, PageEncryptionContext, PageSummary } from "../types";

const LocalPageRow = z.object({
  id: z.string(),
  envelope: z.string(),
  summaryEnvelope: z.string(),
  remoteRevision: z.number().int().nonnegative(),
  localVersion: z.number().int().positive(),
  localUpdatedAt: z.string(),
  remoteUpdatedAt: z.string().nullable(),
});

type LocalPageRow = z.infer<typeof LocalPageRow>;

function parseEnvelope(value: string) {
  return PageEnvelope.parse(JSON.parse(value));
}

async function toPage(row: LocalPageRow, encryption: PageEncryptionContext): Promise<Page> {
  const document = await decryptPageEnvelope(row.id, parseEnvelope(row.envelope), encryption);
  return {
    document,
    revision: row.remoteRevision,
    updatedAt: row.localUpdatedAt,
  };
}

async function toSummary(
  row: LocalPageRow,
  encryption: PageEncryptionContext,
): Promise<PageSummary> {
  const summary = await decryptPageSummaryEnvelope(
    row.id,
    parseEnvelope(row.summaryEnvelope),
    encryption,
  );
  return {
    id: summary.id,
    title: summary.title,
    revision: row.remoteRevision,
    updatedAt: row.localUpdatedAt,
  };
}

const selectColumns = `
  id,
  envelope,
  summary_envelope AS summaryEnvelope,
  remote_revision AS remoteRevision,
  local_version AS localVersion,
  local_updated_at AS localUpdatedAt,
  remote_updated_at AS remoteUpdatedAt
`;

export async function listLocalPages(
  vaultId: string,
  encryption: PageEncryptionContext,
): Promise<PageSummary[]> {
  const database = await getLocalDatabase();
  const rows = LocalPageRow.array().parse(
    await database.select(
      `SELECT ${selectColumns}
       FROM local_pages
       WHERE vault_id = $1 AND deleted_at IS NULL
       ORDER BY local_updated_at DESC, id`,
      [vaultId],
    ),
  );
  return Promise.all(rows.map((row) => toSummary(row, encryption)));
}

export async function getLocalPage(
  vaultId: string,
  pageId: string,
  encryption: PageEncryptionContext,
): Promise<Page | null> {
  const database = await getLocalDatabase();
  const rows = LocalPageRow.array().parse(
    await database.select(
      `SELECT ${selectColumns}
       FROM local_pages
       WHERE vault_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [vaultId, pageId],
    ),
  );
  return rows[0] ? toPage(rows[0], encryption) : null;
}

export async function saveLocalPage(
  vaultId: string,
  page: Page,
  encryption: PageEncryptionContext,
): Promise<Page> {
  const database = await getLocalDatabase();
  const [envelope, summaryEnvelope] = await Promise.all([
    encryptPage(page.document, encryption),
    encryptPageSummary(page.document, encryption),
  ]);
  const updatedAt = new Date().toISOString();
  const operationId = crypto.randomUUID();

  await database.execute(
    `INSERT INTO local_pages (
       vault_id, id, envelope, summary_envelope, remote_revision, local_version,
       local_updated_at, remote_updated_at, pending_operation_id, sync_state
     ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, 'pending')
     ON CONFLICT (vault_id, id) DO UPDATE SET
       envelope = excluded.envelope,
       summary_envelope = excluded.summary_envelope,
       local_version = local_pages.local_version + 1,
       local_updated_at = excluded.local_updated_at,
       pending_operation_id = excluded.pending_operation_id,
       sync_state = 'pending',
       deleted_at = NULL`,
    [
      vaultId,
      page.document.id,
      JSON.stringify(envelope),
      JSON.stringify(summaryEnvelope),
      page.revision,
      updatedAt,
      page.revision > 0 ? page.updatedAt : null,
      operationId,
    ],
  );

  return { ...page, updatedAt };
}
