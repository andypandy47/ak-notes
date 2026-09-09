import { createContext } from "react";
import type { PageConflictError } from "../api/pages";
import type { Page, PageChanges } from "../types";

export type NotebookContextValue = {
  activePage: Page | null;
  visiblePages: Page[];
  pageCount: number;
  isLoading: boolean;
  loadError: Error | null;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: Error | null;
  conflict: PageConflictError | null;
  query: string;
  setQuery: (query: string) => void;
  selectPage: (id: string) => void;
  updatePage: (id: string, changes: PageChanges) => void;
  addPage: () => void;
  retrySave: () => Promise<boolean>;
  useServerVersion: () => void;
  prepareToLock: () => Promise<boolean>;
};

export const NotebookContext = createContext<NotebookContextValue | null>(null);
