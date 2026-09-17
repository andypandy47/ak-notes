import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { useMutationState } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { QUERY_KEYS, useListVaultsQuery } from "../api/vault";
import { useVault } from "../hooks/use-vault";
import { ConnectVaultForm } from "./connect-vault-form";
import { CreateVaultForm } from "./create-vault-form";
import { RecoverVaultForm } from "./recover-vault-form";
import { UnlockDeviceForm } from "./unlock-device-form";
import { UnlockVaultForm } from "./unlock-vault-form";
import { VaultPanel } from "./vault-panel";

export function VaultGate({ children }: { children: ReactNode }) {
  const { isManualTokenEntryRequested, connection, session, hasDeviceCredential, connect } =
    useVault();

  if (hasDeviceCredential.isLoading) {
    return (
      <VaultPanel
        title="Opening AK Notes"
        description="Checking this device for a saved credential."
        isLoading={true}
      >
        <></>
      </VaultPanel>
    );
  }

  if (session && connection) {
    return children;
  }

  if (connection) {
    return <ConnectedVault />;
  }

  if (hasDeviceCredential.data && !isManualTokenEntryRequested) {
    return <UnlockDeviceForm />;
  }

  return <ConnectVaultForm onConnect={connect} />;
}

function ConnectedVault() {
  const { connection, disconnect } = useVault();
  const listVaults = useListVaultsQuery(connection);

  if (listVaults.data === undefined) {
    if (listVaults.isPending) {
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
          <FieldError>{listVaults.error?.message}</FieldError>
          <Button onClick={() => void listVaults.refetch()}>Retry</Button>
        </FieldGroup>
      </VaultPanel>
    );
  }

  return <VaultAccess hasExistingVault={Boolean(listVaults.data?.length)} />;
}

function VaultAccess({ hasExistingVault }: { hasExistingVault: boolean }) {
  const { connection, accessMode } = useVault();
  const createVaultMutations = useMutationState({
    filters: {
      mutationKey: [QUERY_KEYS.vault, connection?.sessionId ?? "disconnected", "create"],
    },
  });

  if (!connection) {
    throw new Error("No connection available.");
  }

  const isCreatingVault = createVaultMutations.length > 0;
  const props = { connection };
  if (!hasExistingVault || isCreatingVault) {
    return <CreateVaultForm {...props} />;
  }

  if (accessMode === "recover") {
    return <RecoverVaultForm {...props} />;
  }

  return <UnlockVaultForm {...props} />;
}
