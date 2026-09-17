import { createContext } from "react";

export type SyncStatus = "idle" | "pending" | "syncing" | "offline" | "error";

export type SyncContextValue = {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: Error | null;
  requestSync: () => void;
};

export const SyncContext = createContext<SyncContextValue | null>(null);
