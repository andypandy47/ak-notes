import { fetchRemotePage, listAllRemotePages, uploadPage } from "./sync-api";
import {
  acknowledgeOperation,
  getLocalPageSyncRecords,
  getPendingOperations,
  markOperationFailed,
  recordSyncCompleted,
  storeRemotePage,
} from "./sync-repository";
import type { SyncResult } from "./types";

export async function syncVault({
  token,
  vaultId,
}: {
  token: string;
  vaultId: string;
}): Promise<SyncResult> {
  const pending = await getPendingOperations(vaultId);
  for (const operation of pending) {
    try {
      const saved = await uploadPage(token, operation);
      await acknowledgeOperation(vaultId, operation, saved.revision, saved.updatedAt);
    } catch (error) {
      await markOperationFailed(vaultId, operation.operationId, error);
      throw error;
    }
  }

  const [remotePages, localRecords] = await Promise.all([
    listAllRemotePages(token),
    getLocalPageSyncRecords(vaultId),
  ]);
  const localById = new Map(localRecords.map((record) => [record.pageId, record]));
  const changedPageIds: string[] = [];

  for (const summary of remotePages) {
    const local = localById.get(summary.id);
    if (local && (local.syncState !== "synced" || local.remoteRevision >= summary.revision)) {
      continue;
    }
    const page = await fetchRemotePage(token, summary.id);
    if (await storeRemotePage(vaultId, page, summary)) {
      changedPageIds.push(page.id);
    }
  }

  await recordSyncCompleted(vaultId);
  return { changedPageIds };
}
