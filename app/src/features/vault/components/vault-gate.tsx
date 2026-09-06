import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useVaultQuery, type VaultConnection } from "../api/vault";
import type { VaultSession } from "../types";
import { ConnectVaultForm } from "./connect-vault-form";
import { CreateVaultForm } from "./create-vault-form";
import { RecoverVaultForm } from "./recover-vault-form";
import { UnlockVaultForm } from "./unlock-vault-form";
import { VaultPanel } from "./vault-panel";

type Content = (session: VaultSession, lock: () => void) => ReactNode;

export function VaultGate({ children }: { children: Content }) {
  const [connection, setConnection] = useState<VaultConnection | null>(null);
  const queryClient = useQueryClient();

  function disconnect() {
    setConnection(null);
    queryClient.clear();
  }

  if (connection) {
    return (
      <ConnectedVault key={connection.sessionId} connection={connection} disconnect={disconnect}>
        {children}
      </ConnectedVault>
    );
  }

  return <ConnectVaultForm onConnect={setConnection} />;
}

function ConnectedVault({
  connection,
  disconnect,
  children,
}: {
  connection: VaultConnection;
  disconnect: () => void;
  children: Content;
}) {
  const vaultQuery = useVaultQuery(connection);
  const [session, setSession] = useState<VaultSession | null>(null);
  if (session) {
    return children(session, disconnect);
  }
  if (vaultQuery.data === undefined) {
    if (vaultQuery.isPending) {
      return (
        <VaultPanel
          title="Opening your vault"
          description="Checking the encrypted vault record."
          isLoading={true}
        >
          <></>
        </VaultPanel>
      );
    }
    return (
      <VaultPanel
        title="Could not open the vault"
        description="Check the API connection before continuing."
        footer={
          <Button variant="ghost" onClick={disconnect}>
            Disconnect
          </Button>
        }
      >
        <FieldGroup>
          <FieldError>{vaultQuery.error?.message}</FieldError>
          <Button onClick={() => void vaultQuery.refetch()}>Retry</Button>
        </FieldGroup>
      </VaultPanel>
    );
  }
  return (
    <VaultAccess
      initiallyCreating={vaultQuery.data === null}
      connection={connection}
      disconnect={disconnect}
      onUnlocked={setSession}
    />
  );
}

function VaultAccess({
  initiallyCreating,
  connection,
  disconnect,
  onUnlocked,
}: {
  initiallyCreating: boolean;
  connection: VaultConnection;
  disconnect: () => void;
  onUnlocked: (session: VaultSession) => void;
}) {
  // Keep creation mounted while its mutation reconciles the server record, preserving the recovery draft.
  const [screen, setScreen] = useState<"create" | "unlock" | "recover">(
    initiallyCreating ? "create" : "unlock",
  );
  const props = { connection, disconnect, onUnlocked };
  if (screen === "create") {
    return <CreateVaultForm {...props} />;
  }

  if (screen === "recover") {
    return <RecoverVaultForm {...props} onUnlock={() => setScreen("unlock")} />;
  }

  return <UnlockVaultForm {...props} onRecover={() => setScreen("recover")} />;
}
