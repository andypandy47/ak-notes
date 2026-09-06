import { createContext } from "react";
import type { Page, PageChanges } from "../types";

export type NotebookContextValue = {
  activePage: Page | null;
  visiblePages: Page[];
  pageCount: number;
  query: string;
  setQuery: (query: string) => void;
  selectPage: (id: string) => void;
  updatePage: (id: string, changes: PageChanges) => void;
  addPage: () => void;
};

export const NotebookContext = createContext<NotebookContextValue | null>(null);
