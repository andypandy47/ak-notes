import { SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSync } from "@/features/sync/use-sync";
import { CircleAlert, CircleCheck, GlobeOff } from "lucide-react";
import { NotePage } from "./note-page";
import { NoteToolbar } from "./note-toolbar";
import { NotebookSidebar } from "./notebook-sidebar";

export function Notebook() {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <NotebookSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <NoteToolbar />
          <div className="flex-1 overflow-auto">
            <NotePage />
          </div>
          <footer className="flex justify-between items-center gap-2 h-12 border-t border-border px-4 py-3 text-xs text-muted-foreground md:px-7">
            <NotebookPersistenceStatus />
            <span className="text-right">End-to-end encrypted · automatically saved</span>
          </footer>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function NotebookPersistenceStatus() {
  const sync = useSync();

  const syncStatusMessage = () => {
    if (sync.status === "syncing") {
      return (
        <>
          <Spinner className="size-4 animate-spin" /> Syncing changes...
        </>
      );
    }
    if (sync.status === "offline") {
      return (
        <>
          <GlobeOff className="size-4" /> No connection
        </>
      );
    }
    if (sync.status === "error") {
      return (
        <>
          <CircleAlert className="size-4 stroke-red-500" />{" "}
          {sync.error?.message ?? "Saved on this device · sync needs attention"}
        </>
      );
    }
    if (sync.status === "pending") {
      return (
        <>
          <Spinner className="size-4 animate-spin" />
          {sync.pendingCount} {sync.pendingCount === 1 ? "change" : "changes"} waiting to sync
        </>
      );
    }
    return (
      <>
        <CircleCheck className="size-5 fill-green-600 stroke-background" />
        All changes synced
      </>
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-start gap-1 text-xs text-muted-foreground">
      {syncStatusMessage()}
    </div>
  );
}
