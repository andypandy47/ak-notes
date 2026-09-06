import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Notebook } from "@/features/notes/components/notebook";
import { NotebookProvider } from "@/features/notes/context/notebook-provider";
import { VaultGate } from "@/features/vault/components/vault-gate";
import { Button } from "@/components/ui/button";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <VaultGate>
        {(_session, lock) => (
          <NotebookProvider>
            <Notebook
              status={
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Vault unlocked · notebook preview edits are still session-only.
                  </p>
                  <Button variant="outline" size="sm" onClick={lock}>
                    Lock and discard preview edits
                  </Button>
                </div>
              }
            />
          </NotebookProvider>
        )}
      </VaultGate>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
