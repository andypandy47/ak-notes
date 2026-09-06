import { NotebookContext } from "./notebook-context";
import { useState, type ReactNode } from "react";
import type { Page, PageChanges } from "../types";

// Session-only state. Persistence and server synchronization belong in a future data layer.
export function NotebookProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const activePage = pages.find((page) => page.id === activeId) ?? null;
  const visiblePages = pages.filter((page) =>
    page.title.toLowerCase().includes(query.toLowerCase()),
  );

  function updatePage(id: string, changes: PageChanges) {
    setPages((current) =>
      current.map((page) =>
        page.id === id ? { ...page, ...changes, updated: new Date().toISOString() } : page,
      ),
    );
  }

  function addPage() {
    const id = crypto.randomUUID();
    setPages((current) => [
      ...current,
      {
        id,
        title: "",
        updated: new Date().toISOString(),
        blocks: [{ type: "paragraph" }],
      },
    ]);
    setActiveId(id);
    setQuery("");
  }

  const value = {
    activePage,
    visiblePages,
    pageCount: pages.length,
    query,
    setQuery,
    selectPage: (id: string) => {
      if (pages.some((page) => page.id === id)) {
        setActiveId(id);
      }
    },
    updatePage,
    addPage,
  };

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}
