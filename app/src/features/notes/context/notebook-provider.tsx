import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageConflictError, pagesKey, usePagesQuery, useSavePageMutation } from "../api/pages";
import type { NotesConnection, Page, PageChanges, PageEncryptionContext } from "../types";
import { NotebookContext } from "./notebook-context";

const SAVE_DELAY_MS = 750;

export function NotebookProvider({
  connection,
  encryption,
  children,
}: {
  connection: NotesConnection;
  encryption: PageEncryptionContext;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const pagesQuery = usePagesQuery(connection, encryption);
  const savePage = useSavePageMutation(connection, encryption);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dirtyIds = useRef(new Set<string>());
  const savingPages = useRef(new Map<string, Promise<boolean>>());
  const queryKey = useMemo(() => pagesKey(connection), [connection]);
  const pages = pagesQuery.data ?? [];
  const activePage = pages.find((page) => page.document.id === activeId) ?? pages[0] ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePages = normalizedQuery
    ? pages.filter((page) => page.document.title.toLowerCase().includes(normalizedQuery))
    : pages;

  function currentPage(id: string) {
    return queryClient.getQueryData<Page[]>(queryKey)?.find((page) => page.document.id === id);
  }

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
    const page = currentPage(id);
    if (!page) {
      dirtyIds.current.delete(id);
      return true;
    }

    const save = (async () => {
      dirtyIds.current.delete(id);
      let failed = false;
      try {
        await savePage.mutateAsync(page);
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
    queryClient.setQueryData<Page[]>(queryKey, (current) =>
      current?.map((page) =>
        page.document.id === id ? { ...page, document: { ...page.document, ...changes } } : page,
      ),
    );
    dirtyIds.current.add(id);
    scheduleSave(id);
  }

  function addPage() {
    if (savePage.isError) {
      savePage.reset();
    }
    const id = crypto.randomUUID();
    const page: Page = {
      document: { version: 1, id, title: "", blocks: [{ type: "paragraph" }] },
      revision: 0,
      updatedAt: new Date().toISOString(),
    };
    queryClient.setQueryData<Page[]>(queryKey, (current) => [...(current ?? []), page]);
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

  function useServerVersion() {
    if (!(savePage.error instanceof PageConflictError)) {
      return;
    }
    const serverPage = savePage.error.serverPage;
    dirtyIds.current.delete(serverPage.document.id);
    queryClient.setQueryData<Page[]>(queryKey, (current) =>
      current?.map((page) => (page.document.id === serverPage.document.id ? serverPage : page)),
    );
    savePage.reset();
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
    await queryClient.cancelQueries({ queryKey });
    queryClient.removeQueries({ queryKey });
    return true;
  }

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }
      void queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    };
  }, [queryClient, queryKey]);

  const conflict = savePage.error instanceof PageConflictError ? savePage.error : null;
  const value = {
    activePage,
    visiblePages,
    pageCount: pages.length,
    isLoading: pagesQuery.isLoading,
    loadError: pagesQuery.error,
    saveStatus: savePage.isPending
      ? ("saving" as const)
      : savePage.isError
        ? ("error" as const)
        : savePage.isSuccess
          ? ("saved" as const)
          : ("idle" as const),
    saveError: savePage.error,
    conflict,
    query,
    setQuery,
    selectPage: (id: string) => {
      if (pages.some((page) => page.document.id === id)) {
        setActiveId(id);
      }
    },
    updatePage,
    addPage,
    retrySave,
    useServerVersion,
    prepareToLock,
  };

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}
