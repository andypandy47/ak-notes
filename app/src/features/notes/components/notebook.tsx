import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSync } from "@/features/sync/use-sync";
import { useVault } from "@/features/vault/hooks/use-vault";
import { CircleAlert, CircleCheck, GlobeOff } from "lucide-react";
import { useNotebook } from "../hooks/use-notebook";
import { NotePage } from "./note-page";
import { NoteToolbar } from "./note-toolbar";
import { NotebookSidebar } from "./notebook-sidebar";

export function Notebook() {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <NotebookSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <NotebookPersistenceStatus />
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

function NotebookPersistenceStatus() {
  const { saveStatus, retrySave, prepareToLock } = useNotebook();
  const { lock } = useVault();
  const sync = useSync();

  async function handleLock() {
    if (await prepareToLock()) {
      lock();
    }
  }

  const syncStatusMessage = syncStatus(sync.status, sync.pendingCount, sync.error);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2 md:px-7">
      <p className="text-sm text-muted-foreground flex items-center gap-1 " role="status">
        {syncStatusMessage}
      </p>
      <div className="flex flex-wrap gap-2">
        {saveStatus === "error" && (
          <Button variant="outline" size="sm" onClick={() => void retrySave()}>
            Retry save
          </Button>
        )}
        {sync.status === "error" && (
          <Button variant="outline" size="sm" onClick={sync.requestSync}>
            Retry sync
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void handleLock()}>
          Lock
        </Button>
      </div>
    </div>
  );
}

function syncStatus(
  syncStatus: "idle" | "pending" | "syncing" | "offline" | "error",
  pendingCount: number,
  syncError: Error | null,
): React.ReactNode {
  if (syncStatus === "syncing") {
    return (
      <>
        <Spinner className="size-4 mr-1 animate-spin" /> Syncing changes...
      </>
    );
  }
  if (syncStatus === "offline") {
    return (
      <>
        <GlobeOff className="size-4" /> No connection
      </>
    );
  }
  if (syncStatus === "error") {
    return (
      <>
        <CircleAlert className="size-4 stroke-red-500" />{" "}
        {syncError?.message ?? "Saved on this device · sync needs attention"}
      </>
    );
  }
  if (syncStatus === "pending") {
    return (
      <>
        <Spinner className="size-4 mr-1 animate-spin" />
        {pendingCount} {pendingCount === 1 ? "change" : "changes"} waiting to sync
      </>
    );
  }
  return (
    <>
      <CircleCheck className="size-5 fill-green-600 stroke-background" /> All changes synced
    </>
  );
}
