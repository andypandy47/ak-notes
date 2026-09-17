import { createContext } from "react";
import type { Page, PageChanges, PageSummary } from "../types";

export type NotebookContextValue = {
  activePage: Page | null;
  activeSummary: PageSummary | null;
  visiblePages: PageSummary[];
  pageCount: number;
  isLoading: boolean;
  isPageLoading: boolean;
  loadError: Error | null;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: Error | null;
  query: string;
  setQuery: (query: string) => void;
  selectPage: (id: string) => void;
  updatePage: (id: string, changes: PageChanges) => void;
  addPage: () => void;
  retrySave: () => Promise<boolean>;
  prepareToLock: () => Promise<boolean>;
};

export const NotebookContext = createContext<NotebookContextValue | null>(null);
