import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, checkApiStatus } from "@/lib/api-client";
import { VaultRecord, type VaultDocument, type PassphraseKey } from "../types";

const ResponseRecord = z.object({ success: z.literal(true), vault: VaultRecord });

export type VaultConnection = { token: string; sessionId: string };

export const QUERY_KEYS = { vault: "vaults" } as const;
const vaultKey = (connection: VaultConnection) => [QUERY_KEYS.vault, connection.sessionId] as const;

export const listVaultsQueryOptions = (connection: VaultConnection | null) =>
  queryOptions({
    queryKey: connection ? vaultKey(connection) : [QUERY_KEYS.vault, "disconnected"],
    queryFn: async ({ signal }) => {
      const response = await apiRequest(connection?.token ?? "", "/vaults", { signal });
      checkApiStatus(response);
      return z
        .object({ success: z.literal(true), vaults: VaultRecord.array() })
        .parse(await response.json()).vaults;
    },
    staleTime: Infinity,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    enabled: Boolean(connection),
  });

export const useListVaultsQuery = (connection: VaultConnection | null) =>
  useQuery(listVaultsQueryOptions(connection));

export const getVaultQueryOptions = (connection: VaultConnection, vaultId: string | undefined) =>
  queryOptions({
    queryKey: [...vaultKey(connection), vaultId],
    enabled: Boolean(vaultId),
    queryFn: async ({ signal }): Promise<VaultRecord | null> => {
      if (!vaultId) {
        throw new Error("A vault ID is required.");
      }
      const response = await apiRequest(
        connection.token,
        `/vaults/${encodeURIComponent(vaultId)}`,
        { signal },
      );
      if (response.status === 404) {
        return null;
      }
      checkApiStatus(response);
      return ResponseRecord.parse(await response.json()).vault;
    },
    staleTime: Infinity,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

export const useGetVaultQuery = (connection: VaultConnection, vaultId: string | undefined) =>
  useQuery(getVaultQueryOptions(connection, vaultId));

async function cacheVault(
  queryClient: QueryClient,
  connection: VaultConnection,
  vault: VaultRecord,
) {
  // Stop an older read overwriting the mutation result. Disconnect removes this query;
  // a late response must not recreate the disconnected session's cache.
  await queryClient.cancelQueries({ queryKey: vaultKey(connection) });
  if (queryClient.getQueryState(vaultKey(connection))) {
    queryClient.setQueryData<VaultRecord[]>(vaultKey(connection), (existing) =>
      existing?.some((item) => item.document.id === vault.document.id)
        ? existing.map((item) => (item.document.id === vault.document.id ? vault : item))
        : [...(existing ?? []), vault],
    );
  }
  const detailKey = getVaultQueryOptions(connection, vault.document.id).queryKey;
  if (queryClient.getQueryState(detailKey)) {
    queryClient.setQueryData(detailKey, vault);
  }
}

export function useCreateVaultMutation(connection: VaultConnection) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [QUERY_KEYS.vault, connection.sessionId, "create"],
    retry: false,
    gcTime: 0,
    mutationFn: async (document: VaultDocument) => {
      try {
        const response = await apiRequest(connection.token, "/vaults", {
          method: "POST",
          body: JSON.stringify(document),
        });
        checkApiStatus(response);
        return ResponseRecord.parse(await response.json()).vault;
      } catch (error) {
        if (!queryClient.getQueryState(vaultKey(connection))) {
          throw error;
        }
        // The create may have succeeded before its response was lost. Reconcile through
        // a fresh TanStack query and accept only an exact match to this encrypted draft.
        const existing = await queryClient
          .fetchQuery({ ...getVaultQueryOptions(connection, document.id), staleTime: 0 })
          .catch(() => null);
        if (existing && JSON.stringify(existing.document) === JSON.stringify(document)) {
          return existing;
        }
        throw error;
      }
    },
    onSuccess: (vault) => cacheVault(queryClient, connection, vault),
  });
}

export function useUpdateVaultPassphraseMutation(connection: VaultConnection) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [QUERY_KEYS.vault, connection.sessionId, "update-passphrase"],
    retry: false,
    gcTime: 0,
    // Only the encrypted wrapper enters mutation state, never an unlocking secret or key.
    mutationFn: async ({
      vaultId,
      ...data
    }: {
      vaultId: string;
      expectedRevision: number;
      passphrase: PassphraseKey;
    }) => {
      const response = await apiRequest(
        connection.token,
        `/vaults/${encodeURIComponent(vaultId)}/passphrase`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
      checkApiStatus(response);
      return ResponseRecord.parse(await response.json()).vault;
    },
    onSuccess: (vault) => cacheVault(queryClient, connection, vault),
  });
}
