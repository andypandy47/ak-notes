import { getLocalDatabase } from "@/lib/local-database";
import { PageEnvelope } from "@/types/encrypted-page";
import { z } from "zod";
import type {
  LocalPageSyncRecord,
  PendingPageOperation,
  PersistedSyncStatus,
  RemotePage,
  RemotePageSummary,
} from "./types";

const PendingOperationRow = z.object({
  pageId: z.string(),
  operationId: z.string(),
  expectedRevision: z.number().int().nonnegative(),
  envelope: z.string(),
  summaryEnvelope: z.string(),
});

const LocalPageSyncRow = z.object({
  pageId: z.string(),
  remoteRevision: z.number().int().nonnegative(),
  syncState: z.enum(["pending", "synced", "conflict"]),
});

const SyncStatusRow = z.object({
  pendingCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  lastSyncedAt: z.string().nullable(),
});

export async function getPendingOperations(vaultId: string): Promise<PendingPageOperation[]> {
  const database = await getLocalDatabase();
  const rows = PendingOperationRow.array().parse(
    await database.select(
      `SELECT
         operations.page_id AS pageId,
         operations.operation_id AS operationId,
         operations.expected_revision AS expectedRevision,
         pages.envelope,
         pages.summary_envelope AS summaryEnvelope
       FROM sync_operations AS operations
       INNER JOIN local_pages AS pages
         ON pages.vault_id = operations.vault_id AND pages.id = operations.page_id
       WHERE operations.vault_id = $1
       ORDER BY operations.created_at, operations.page_id`,
      [vaultId],
    ),
  );
  return rows.map((row) => ({
    ...row,
    envelope: PageEnvelope.parse(JSON.parse(row.envelope)),
    summaryEnvelope: PageEnvelope.parse(JSON.parse(row.summaryEnvelope)),
  }));
}

export async function acknowledgeOperation(
  vaultId: string,
  operation: PendingPageOperation,
  revision: number,
  updatedAt: string,
) {
  const database = await getLocalDatabase();
  await database.execute(
    `UPDATE local_pages
     SET remote_revision = $1,
         remote_updated_at = $2,
         pending_operation_id = NULL,
         sync_state = 'synced'
     WHERE vault_id = $3 AND id = $4 AND pending_operation_id = $5`,
    [revision, updatedAt, vaultId, operation.pageId, operation.operationId],
  );
}

export async function markOperationFailed(vaultId: string, operationId: string, error: unknown) {
  const database = await getLocalDatabase();
  const message = error instanceof Error ? error.message : "Synchronization failed.";
  await database.execute(
    `UPDATE sync_operations
     SET attempt_count = attempt_count + 1,
         last_attempt_at = $1,
         last_error = $2
     WHERE vault_id = $3 AND operation_id = $4`,
    [new Date().toISOString(), message, vaultId, operationId],
  );
}

export async function getLocalPageSyncRecords(vaultId: string): Promise<LocalPageSyncRecord[]> {
  const database = await getLocalDatabase();
  return LocalPageSyncRow.array().parse(
    await database.select(
      `SELECT id AS pageId, remote_revision AS remoteRevision, sync_state AS syncState
       FROM local_pages
       WHERE vault_id = $1 AND deleted_at IS NULL`,
      [vaultId],
    ),
  );
}

export async function storeRemotePage(
  vaultId: string,
  page: RemotePage,
  summary: RemotePageSummary,
) {
  if (page.id !== summary.id || page.revision !== summary.revision) {
    throw new Error(
      "A remote page changed during synchronization. Retry to get its latest version.",
    );
  }
  if (!summary.summaryEnvelope) {
    throw new Error(`Remote page ${page.id} does not have an encrypted summary.`);
  }
  const database = await getLocalDatabase();
  const result = await database.execute(
    `INSERT INTO local_pages (
       vault_id, id, envelope, summary_envelope, remote_revision, local_version,
       local_updated_at, remote_updated_at, pending_operation_id, sync_state
     ) VALUES ($1, $2, $3, $4, $5, 1, $6, $6, NULL, 'synced')
     ON CONFLICT (vault_id, id) DO UPDATE SET
       envelope = excluded.envelope,
       summary_envelope = excluded.summary_envelope,
       remote_revision = excluded.remote_revision,
       local_version = local_pages.local_version + 1,
       local_updated_at = excluded.local_updated_at,
       remote_updated_at = excluded.remote_updated_at,
       pending_operation_id = NULL,
       sync_state = 'synced',
       deleted_at = NULL
     WHERE local_pages.sync_state = 'synced'
       AND excluded.remote_revision > local_pages.remote_revision`,
    [
      vaultId,
      page.id,
      JSON.stringify(page.envelope),
      JSON.stringify(summary.summaryEnvelope),
      page.revision,
      page.updatedAt,
    ],
  );
  return result.rowsAffected > 0;
}

export async function getPersistedSyncStatus(vaultId: string): Promise<PersistedSyncStatus> {
  const database = await getLocalDatabase();
  const rows = SyncStatusRow.array().parse(
    await database.select(
      `SELECT
         COUNT(operations.page_id) AS pendingCount,
         COALESCE(SUM(CASE WHEN operations.last_error IS NOT NULL THEN 1 ELSE 0 END), 0) AS failedCount,
         metadata.last_synced_at AS lastSyncedAt
       FROM (SELECT $1 AS vault_id) AS selected
       LEFT JOIN sync_operations AS operations ON operations.vault_id = selected.vault_id
       LEFT JOIN sync_metadata AS metadata ON metadata.vault_id = selected.vault_id
       GROUP BY selected.vault_id, metadata.last_synced_at`,
      [vaultId],
    ),
  );
  return rows[0] ?? { pendingCount: 0, failedCount: 0, lastSyncedAt: null };
}

export async function recordSyncCompleted(vaultId: string) {
  const database = await getLocalDatabase();
  await database.execute(
    `INSERT INTO sync_metadata (vault_id, last_synced_at) VALUES ($1, $2)
     ON CONFLICT (vault_id) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    [vaultId, new Date().toISOString()],
  );
}
