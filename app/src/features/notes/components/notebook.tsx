import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotebookSidebar } from "./notebook-sidebar";
import { NoteToolbar } from "./note-toolbar";
import { NotePage } from "./note-page";

export function Notebook({ status }: { status?: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <NotebookSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {status}
          <NoteToolbar />
          <div className="flex-1 overflow-auto">
            <NotePage />
          </div>
          <footer className="flex justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground md:px-7">
            <span>Room to think.</span>
            <span>End-to-end encrypted · automatically saved</span>
          </footer>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}
