import type { EncryptedPage, EncryptedPageSummary, PageEnvelope } from "@/types/encrypted-page";

export type PendingPageOperation = {
  pageId: string;
  operationId: string;
  expectedRevision: number;
  envelope: PageEnvelope;
  summaryEnvelope: PageEnvelope;
};

export type LocalPageSyncRecord = {
  pageId: string;
  remoteRevision: number;
  syncState: "pending" | "synced" | "conflict";
};

export type PersistedSyncStatus = {
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
};

export type SyncResult = {
  changedPageIds: string[];
};

export type RemotePage = EncryptedPage;
export type RemotePageSummary = EncryptedPageSummary;
