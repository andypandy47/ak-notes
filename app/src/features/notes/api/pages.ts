import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, checkApiStatus } from "@/lib/api-client";
import { decryptPage, encryptPage, EncryptedPage } from "../crypto";
import type { NotesConnection, Page, PageEncryptionContext } from "../types";

const PageMetadata = EncryptedPage.omit({ envelope: true });
const ListResponse = z.object({
  success: z.literal(true),
  pages: PageMetadata.array(),
  nextCursor: z.uuid().nullable(),
});
const PageResponse = z.object({ success: z.literal(true), page: EncryptedPage });

export const PAGE_QUERY_KEY = "pages";
export const pagesKey = (connection: NotesConnection) =>
  [PAGE_QUERY_KEY, connection.sessionId] as const;

async function fetchEncryptedPage(
  connection: NotesConnection,
  pageId: string,
  signal?: AbortSignal,
) {
  const response = await apiRequest(connection.token, `/pages/${encodeURIComponent(pageId)}`, {
    signal,
  });
  checkApiStatus(response);
  return PageResponse.parse(await response.json()).page;
}

async function fetchAllPageMetadata(connection: NotesConnection, signal?: AbortSignal) {
  const pages: z.infer<typeof PageMetadata>[] = [];
  let after: string | null = null;
  do {
    const suffix = after
      ? `/pages?limit=100&after=${encodeURIComponent(after)}`
      : "/pages?limit=100";
    const response = await apiRequest(connection.token, suffix, { signal });
    checkApiStatus(response);
    const result = ListResponse.parse(await response.json());
    pages.push(...result.pages);
    after = result.nextCursor;
  } while (after);
  return pages;
}

export const pagesQueryOptions = (connection: NotesConnection, encryption: PageEncryptionContext) =>
  queryOptions({
    queryKey: pagesKey(connection),
    queryFn: async ({ signal }) => {
      const metadata = await fetchAllPageMetadata(connection, signal);
      return Promise.all(
        metadata.map(async ({ id }) =>
          decryptPage(await fetchEncryptedPage(connection, id, signal), encryption),
        ),
      );
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

export const usePagesQuery = (connection: NotesConnection, encryption: PageEncryptionContext) =>
  useQuery(pagesQueryOptions(connection, encryption));

export class PageConflictError extends Error {
  constructor(public readonly serverPage: Page) {
    super("This page changed on another device. Your local edits have been preserved.");
    this.name = "PageConflictError";
  }
}

export function useSavePageMutation(
  connection: NotesConnection,
  encryption: PageEncryptionContext,
) {
  const queryClient = useQueryClient();
  const queryKey = pagesKey(connection);
  return useMutation({
    mutationKey: [...queryKey, "save"],
    retry: false,
    gcTime: 0,
    mutationFn: async (page: Page) => {
      const envelope = await encryptPage(page.document, encryption);
      const response = await apiRequest(
        connection.token,
        `/pages/${encodeURIComponent(page.document.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ expectedRevision: page.revision, envelope }),
        },
      );
      if (response.status === 409) {
        const serverPage = await decryptPage(
          await fetchEncryptedPage(connection, page.document.id),
          encryption,
        );
        throw new PageConflictError(serverPage);
      }
      checkApiStatus(response);
      const saved = PageResponse.parse(await response.json()).page;
      return saved;
    },
    onSuccess: (saved, source) => {
      queryClient.setQueryData<Page[]>(queryKey, (pages) =>
        pages?.map((page) =>
          page.document.id === source.document.id
            ? { ...page, revision: saved.revision, updatedAt: saved.updatedAt }
            : page,
        ),
      );
    },
  });
}
