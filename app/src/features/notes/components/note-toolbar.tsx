import { BookOpen } from "lucide-react";
import { useNotebook } from "../hooks/use-notebook";
import { useVault } from "@/features/vault/hooks/use-vault";
import { Button } from "@/components/ui/button";

export function NoteToolbar() {
  const { activeSummary } = useNotebook();
  const { lock } = useVault();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
        <BookOpen className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">My notebook</span>
        <span className="hidden text-border sm:inline">/</span>
        <span className="truncate">
          {activeSummary ? activeSummary.title || "Untitled" : "Your pages"}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={() => void lock()}>
        Lock
      </Button>
    </header>
  );
}
