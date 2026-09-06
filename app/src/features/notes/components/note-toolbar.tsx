import { BookOpen } from "lucide-react";
import { useNotebook } from "../hooks/use-notebook";

export function NoteToolbar() {
  const { activePage } = useNotebook();
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
        <BookOpen className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">My notebook</span>
        <span className="hidden text-border sm:inline">/</span>
        <span className="truncate">
          {activePage ? activePage.title || "Untitled" : "Your pages"}
        </span>
      </div>
      <span className="hidden text-xs tracking-widest whitespace-nowrap text-muted-foreground lg:inline">
        PERSONAL NOTEBOOK
      </span>
    </header>
  );
}
