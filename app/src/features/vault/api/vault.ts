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

export const QUERY_KEYS = { vault: "vault" } as const;
const vaultKey = (connection: VaultConnection) => [QUERY_KEYS.vault, connection.sessionId] as const;

const vaultQueryOptions = (connection: VaultConnection) =>
  queryOptions({
    // Cache keys identify a session without exposing its bearer token.
    queryKey: vaultKey(connection),
    queryFn: async ({ signal }): Promise<VaultRecord | null> => {
      const response = await apiRequest(connection.token, "/vault", { signal });
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

export const useVaultQuery = (connection: VaultConnection) =>
  useQuery(vaultQueryOptions(connection));

async function cacheVault(
  queryClient: QueryClient,
  connection: VaultConnection,
  vault: VaultRecord,
) {
  // Stop an older read overwriting the mutation result. Disconnect removes this query;
  // a late response must not recreate the disconnected session's cache.
  await queryClient.cancelQueries({ queryKey: vaultKey(connection), exact: true });
  if (queryClient.getQueryState(vaultKey(connection))) {
    queryClient.setQueryData(vaultKey(connection), vault);
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
        const response = await apiRequest(connection.token, "/vault", {
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
          .fetchQuery({ ...vaultQueryOptions(connection), staleTime: 0 })
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
    mutationFn: async (data: { expectedRevision: number; passphrase: PassphraseKey }) => {
      const response = await apiRequest(connection.token, "/vault/passphrase", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      checkApiStatus(response);
      return ResponseRecord.parse(await response.json()).vault;
    },
    onSuccess: (vault) => cacheVault(queryClient, connection, vault),
  });
}
