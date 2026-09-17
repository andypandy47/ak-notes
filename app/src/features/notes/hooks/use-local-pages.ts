import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localPageKeys } from "@/lib/query-keys";
import { getLocalPage, listLocalPages, saveLocalPage } from "../data/local-pages";
import type { Page, PageEncryptionContext, PageSummary } from "../types";

export function useLocalPagesQuery(vaultId: string, encryption: PageEncryptionContext) {
  return useQuery({
    queryKey: localPageKeys.all(vaultId),
    queryFn: () => listLocalPages(vaultId, encryption),
    networkMode: "always",
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export function useLocalPageQuery(
  vaultId: string,
  encryption: PageEncryptionContext,
  pageId: string | null,
) {
  return useQuery({
    queryKey: localPageKeys.detail(vaultId, pageId),
    queryFn: () => getLocalPage(vaultId, pageId!, encryption),
    enabled: pageId !== null,
    networkMode: "always",
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export function useSaveLocalPageMutation(vaultId: string, encryption: PageEncryptionContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...localPageKeys.all(vaultId), "save"],
    mutationFn: (page: Page) => saveLocalPage(vaultId, page, encryption),
    networkMode: "always",
    retry: false,
    gcTime: 0,
    onSuccess: (saved) => {
      queryClient.setQueryData<Page>(localPageKeys.detail(vaultId, saved.document.id), (current) =>
        current ? { ...current, revision: saved.revision, updatedAt: saved.updatedAt } : saved,
      );
      queryClient.setQueryData<PageSummary[]>(localPageKeys.all(vaultId), (summaries) => {
        const nextSummary: PageSummary = {
          id: saved.document.id,
          title: saved.document.title,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
        };
        const current = summaries?.find((item) => item.id === saved.document.id);
        const updated = current
          ? { ...current, revision: saved.revision, updatedAt: saved.updatedAt }
          : nextSummary;
        return [updated, ...(summaries ?? []).filter((item) => item.id !== saved.document.id)];
      });
    },
  });
}
