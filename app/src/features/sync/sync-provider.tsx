import { localPageKeys, syncKeys } from "@/lib/query-keys";
import { onlineManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { SyncContext, type SyncStatus } from "./sync-context";
import { syncVault } from "./sync-engine";
import { getPersistedSyncStatus } from "./sync-repository";
import { useVault } from "../vault/hooks/use-vault";

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session, connection } = useVault();
  const token = connection?.token ?? "";
  const vaultId = session?.vault.document.id ?? "";
  const queryClient = useQueryClient();
  const isOnline = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
  const persisted = useQuery({
    queryKey: syncKeys.status(vaultId),
    queryFn: () => getPersistedSyncStatus(vaultId),
    networkMode: "always",
    staleTime: Infinity,
    retry: false,
  });
  const syncMutation = useMutation({
    mutationKey: syncKeys.status(vaultId),
    scope: { id: `sync:${vaultId}` },
    networkMode: "online",
    mutationFn: () => syncVault({ token, vaultId }),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: localPageKeys.all(vaultId) }),
        queryClient.invalidateQueries({ queryKey: syncKeys.status(vaultId) }),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: syncKeys.status(vaultId) });
    },
  });

  const requestSync = syncMutation.mutate;

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    const hasQueuedSync =
      queryClient.isMutating({ mutationKey: syncKeys.status(vaultId), exact: true }) > 0;
    if (!hasQueuedSync) {
      requestSync();
    }
  }, [isOnline, queryClient, requestSync, vaultId]);

  const syncData = persisted.data;
  const error = syncMutation.error ?? persisted.error;
  const status: SyncStatus = !isOnline
    ? "offline"
    : syncMutation.isPending
      ? "syncing"
      : error
        ? "error"
        : (syncData?.pendingCount ?? 0) > 0
          ? "pending"
          : "idle";

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount: syncData?.pendingCount ?? 0,
        lastSyncedAt: syncData?.lastSyncedAt ?? null,
        error,
        requestSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}
