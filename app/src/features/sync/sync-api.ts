import { apiRequest, checkApiStatus } from "@/lib/api-client";
import { EncryptedPage, EncryptedPageSummary } from "@/types/encrypted-page";
import { z } from "zod";
import type { PendingPageOperation, RemotePageSummary } from "./types";

const ListResponse = z.object({
  success: z.literal(true),
  pages: EncryptedPageSummary.array(),
});
const PageResponse = z.object({ success: z.literal(true), page: EncryptedPage });

export class SyncConflictError extends Error {
  constructor(pageId: string) {
    super(`Page ${pageId} changed on another device. Your local version is still saved.`);
    this.name = "SyncConflictError";
  }
}

export async function listAllRemotePages(token: string): Promise<RemotePageSummary[]> {
  const response = await apiRequest(token, "/pages");
  checkApiStatus(response);
  return ListResponse.parse(await response.json()).pages;
}

export async function fetchRemotePage(token: string, pageId: string) {
  const response = await apiRequest(token, `/pages/${encodeURIComponent(pageId)}`);
  checkApiStatus(response);
  return PageResponse.parse(await response.json()).page;
}

export async function uploadPage(token: string, operation: PendingPageOperation) {
  const response = await apiRequest(token, `/pages/${encodeURIComponent(operation.pageId)}`, {
    method: "PUT",
    body: JSON.stringify({
      expectedRevision: operation.expectedRevision,
      envelope: operation.envelope,
      summaryEnvelope: operation.summaryEnvelope,
    }),
  });
  if (response.status === 409) {
    throw new SyncConflictError(operation.pageId);
  }
  checkApiStatus(response);
  return PageResponse.parse(await response.json()).page;
}
