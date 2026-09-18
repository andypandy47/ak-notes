import { env } from "@/config/environment";
import { Notebook } from "@/features/notes/components/notebook";
import { NotebookProvider } from "@/features/notes/context/notebook-provider";
import { SyncProvider } from "@/features/sync/sync-provider";
import { VaultGate } from "@/features/vault/components/vault-gate";
import { VaultProvider } from "@/features/vault/context/vault-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools/production";
import { useState } from "react";

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <VaultProvider>
        <VaultGate>
          <SyncProvider>
            <NotebookProvider>
              <Notebook />
            </NotebookProvider>
          </SyncProvider>
        </VaultGate>
      </VaultProvider>
      {env.ENABLE_QUERY_DEVTOOLS && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
