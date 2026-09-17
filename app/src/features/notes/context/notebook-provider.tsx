import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { localPageKeys } from "@/lib/query-keys";
import { createPageId } from "../../../lib/ids";
import {
  useLocalPageQuery,
  useLocalPagesQuery,
  useSaveLocalPageMutation,
} from "../hooks/use-local-pages";
import type { Page, PageChanges, PageEncryptionContext, PageSummary } from "../types";
import { NotebookContext } from "./notebook-context";
import { useSync } from "@/features/sync/use-sync";
import { useVault } from "@/features/vault/hooks/use-vault";

const SAVE_DELAY_MS = 750;

export function NotebookProvider({ children }: { children: ReactNode }) {
  const { requestSync } = useSync();
  const { session } = useVault();

  if (!session) {
    throw new Error("No active vault session found.");
  }

  const encryption: PageEncryptionContext = {
    key: session?.key,
    keyId: session?.vault.document.keyId,
  };
  const vaultId = session?.vault.document.id ?? "";

  const queryClient = useQueryClient();
  const summariesQuery = useLocalPagesQuery(vaultId, encryption);
  const savePage = useSaveLocalPageMutation(vaultId, encryption);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dirtyIds = useRef(new Set<string>());
  const savingPages = useRef(new Map<string, Promise<boolean>>());

  const summaries = summariesQuery.data ?? [];
  const selectedId = activeId ?? summaries[0]?.id ?? null;
  const activeSummary = summaries.find((summary) => summary.id === selectedId) ?? null;

  const pageQuery = useLocalPageQuery(vaultId, encryption, selectedId);
  const activePage = pageQuery.data ?? null;

  const normalizedQuery = query.trim().toLowerCase();

  const visiblePages = normalizedQuery
    ? summaries.filter((page) => page.title.toLowerCase().includes(normalizedQuery))
    : summaries;

  async function flushPage(id: string): Promise<boolean> {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    const activeSave = savingPages.current.get(id);
    if (activeSave) {
      const saved = await activeSave;
      return saved && dirtyIds.current.has(id) ? flushPage(id) : saved;
    }

    if (!dirtyIds.current.has(id)) {
      return true;
    }

    const page = queryClient.getQueryData<Page>(localPageKeys.detail(vaultId, id));
    if (!page) {
      dirtyIds.current.delete(id);
      return true;
    }

    const save = (async () => {
      dirtyIds.current.delete(id);
      let failed = false;
      try {
        await savePage.mutateAsync(page);
        requestSync();
        return true;
      } catch {
        failed = true;
        dirtyIds.current.add(id);
        return false;
      } finally {
        savingPages.current.delete(id);
        if (!failed && dirtyIds.current.has(id)) {
          scheduleSave(id);
        }
      }
    })();
    savingPages.current.set(id, save);
    return save;
  }

  function scheduleSave(id: string) {
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    timers.current.set(
      id,
      setTimeout(() => void flushPage(id), SAVE_DELAY_MS),
    );
  }

  function updatePage(id: string, changes: PageChanges) {
    if (savePage.isError) {
      savePage.reset();
    }

    queryClient.setQueryData<Page>(localPageKeys.detail(vaultId, id), (current) =>
      current ? { ...current, document: { ...current.document, ...changes } } : current,
    );
    if (changes.title !== undefined) {
      queryClient.setQueryData<PageSummary[]>(localPageKeys.all(vaultId), (current) =>
        current?.map((summary) =>
          summary.id === id ? { ...summary, title: changes.title! } : summary,
        ),
      );
    }

    dirtyIds.current.add(id);
    scheduleSave(id);
  }

  function addPage() {
    if (savePage.isError) {
      savePage.reset();
    }
    const id = createPageId();
    const updatedAt = new Date().toISOString();
    const page: Page = {
      document: { version: 1, id, title: "", blocks: [{ type: "paragraph" }] },
      revision: 0,
      updatedAt,
    };
    const summary: PageSummary = { id, title: "", revision: 0, updatedAt };
    queryClient.setQueryData<Page>(localPageKeys.detail(vaultId, id), page);
    queryClient.setQueryData<PageSummary[]>(localPageKeys.all(vaultId), (current) => [
      ...(current ?? []),
      summary,
    ]);
    dirtyIds.current.add(id);
    setActiveId(id);
    setQuery("");
    scheduleSave(id);
  }

  async function retrySave() {
    const failedId = savePage.variables?.document.id;
    if (!failedId) {
      return true;
    }
    savePage.reset();
    dirtyIds.current.add(failedId);
    return flushPage(failedId);
  }

  async function prepareToLock() {
    const ids = new Set([
      ...dirtyIds.current,
      ...timers.current.keys(),
      ...savingPages.current.keys(),
    ]);
    const results = await Promise.all([...ids].map(flushPage));
    if (results.some((saved) => !saved)) {
      return false;
    }
    await queryClient.cancelQueries({ queryKey: localPageKeys.all(vaultId) });
    queryClient.removeQueries({ queryKey: localPageKeys.all(vaultId) });
    return true;
  }

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }
      void queryClient.cancelQueries({ queryKey: localPageKeys.all(vaultId) });
      queryClient.removeQueries({ queryKey: localPageKeys.all(vaultId) });
    };
  }, [queryClient, vaultId]);

  const value = {
    activePage,
    activeSummary,
    visiblePages,
    pageCount: summaries.length,
    isLoading: summariesQuery.isLoading,
    isPageLoading: pageQuery.isLoading,
    loadError: summariesQuery.error ?? pageQuery.error,
    saveStatus: savePage.isPending
      ? ("saving" as const)
      : savePage.isError
        ? ("error" as const)
        : savePage.isSuccess
          ? ("saved" as const)
          : ("idle" as const),
    saveError: savePage.error,
    query,
    setQuery,
    selectPage: (id: string) => {
      if (summaries.some((page) => page.id === id)) {
        setActiveId(id);
      }
    },
    updatePage,
    addPage,
    retrySave,
    prepareToLock,
  };

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}
