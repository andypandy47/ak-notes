import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Notebook } from "@/features/notes/components/notebook";
import { NotebookProvider } from "@/features/notes/context/notebook-provider";
import { useNotebook } from "@/features/notes/hooks/use-notebook";
import { VaultGate } from "@/features/vault/components/vault-gate";
import { VaultProvider } from "@/features/vault/context/vault-provider";
import type { VaultConnection } from "@/features/vault/api/vault";
import type { VaultSession } from "@/features/vault/types";
import { Button } from "@/components/ui/button";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <VaultProvider>
        <VaultGate>
          {(session, connection, lock) => (
            <NotebookSession session={session} connection={connection} lock={lock} />
          )}
        </VaultGate>
      </VaultProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

function NotebookSession({
  session,
  connection,
  lock,
}: {
  session: VaultSession;
  connection: VaultConnection;
  lock: () => void;
}) {
  return (
    <NotebookProvider
      connection={connection}
      encryption={{ key: session.key, keyId: session.vault.document.keyId }}
    >
      <Notebook status={<NotebookPersistenceStatus lock={lock} />} />
    </NotebookProvider>
  );
}

function NotebookPersistenceStatus({ lock }: { lock: () => void }) {
  const { saveStatus, saveError, conflict, retrySave, useServerVersion, prepareToLock } =
    useNotebook();

  async function handleLock() {
    if (await prepareToLock()) {
      lock();
    }
  }

  const message =
    saveStatus === "saving"
      ? "Encrypting and saving…"
      : saveStatus === "saved"
        ? "All changes encrypted and saved"
        : saveStatus === "error"
          ? saveError?.message
          : "Vault unlocked · changes save automatically";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2">
      <p className="text-sm text-muted-foreground" role="status">
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        {saveStatus === "error" && !conflict && (
          <Button variant="outline" size="sm" onClick={() => void retrySave()}>
            Retry save
          </Button>
        )}
        {conflict && (
          <Button variant="outline" size="sm" onClick={useServerVersion}>
            Use server version
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void handleLock()}>
          Lock
        </Button>
      </div>
    </div>
  );
}
