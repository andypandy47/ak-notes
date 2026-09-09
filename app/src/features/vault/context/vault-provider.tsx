import { useQueryClient } from "@tanstack/react-query";
import { useReducer, type ReactNode } from "react";
import { getVaultQueryOptions, listVaultsQueryOptions, type VaultConnection } from "../api/vault";
import { unlockVault } from "../crypto";
import {
  lockDeviceCredential,
  useForgetDeviceCredentialMutation,
  useHasDeviceCredential,
  useSaveDeviceCredentialMutation,
  useUnlockDeviceCredentialMutation,
} from "../device-credential";
import type { VaultRecord, VaultSession } from "../types";
import { VaultContext, type VaultAccessMode, type VaultContextValue } from "./vault-context";

type VaultFlowState =
  | { status: "disconnected"; entry: "saved-credential" | "manual-token" }
  | { status: "connected"; connection: VaultConnection; accessMode: VaultAccessMode }
  | { status: "unlocked"; connection: VaultConnection; session: VaultSession };

type VaultFlowAction =
  | { type: "request-manual-token" }
  | { type: "connect"; connection: VaultConnection }
  | { type: "start-recovery" }
  | { type: "cancel-recovery" }
  | { type: "unlock"; connection: VaultConnection; session: VaultSession }
  | { type: "disconnect"; entry: "saved-credential" | "manual-token" };

function vaultFlowReducer(state: VaultFlowState, action: VaultFlowAction): VaultFlowState {
  switch (action.type) {
    case "request-manual-token":
      return { status: "disconnected", entry: "manual-token" };
    case "connect":
      return { status: "connected", connection: action.connection, accessMode: "unlock" };
    case "start-recovery":
      return state.status === "connected" ? { ...state, accessMode: "recover" } : state;
    case "cancel-recovery":
      return state.status === "connected" ? { ...state, accessMode: "unlock" } : state;
    case "unlock":
      return { status: "unlocked", connection: action.connection, session: action.session };
    case "disconnect":
      return { status: "disconnected", entry: action.entry };
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasDeviceCredential = useHasDeviceCredential();
  const unlockDeviceCredential = useUnlockDeviceCredentialMutation();
  const saveDeviceCredential = useSaveDeviceCredentialMutation();
  const forgetDeviceCredential = useForgetDeviceCredentialMutation();
  const [flow, dispatch] = useReducer(vaultFlowReducer, {
    status: "disconnected",
    entry: "saved-credential",
  });

  const connection = flow.status === "disconnected" ? null : flow.connection;
  const session = flow.status === "unlocked" ? flow.session : null;
  const accessMode = flow.status === "connected" ? flow.accessMode : "unlock";
  const isManualTokenEntryRequested =
    flow.status === "disconnected" && flow.entry === "manual-token";

  function lock() {
    dispatch({ type: "disconnect", entry: "saved-credential" });
    void lockDeviceCredential().catch(() => undefined);
  }

  function disconnect() {
    dispatch({ type: "disconnect", entry: "saved-credential" });
  }

  async function openSavedVault(passphrase: string) {
    let token: string;
    try {
      token = await unlockDeviceCredential.mutateAsync(passphrase);
    } finally {
      unlockDeviceCredential.reset();
    }
    const savedConnection = { token, sessionId: crypto.randomUUID() };
    try {
      const vaults = await queryClient.fetchQuery(listVaultsQueryOptions(savedConnection));
      const vaultId = vaults[0]?.document.id;
      if (!vaultId) {
        throw new Error("The saved device credential is not connected to a vault.");
      }
      const vault = await queryClient.fetchQuery(getVaultQueryOptions(savedConnection, vaultId));
      if (!vault) {
        throw new Error("The vault could not be found. Use your API token to reconnect.");
      }
      const key = await unlockVault(vault.document, passphrase);
      dispatch({ type: "unlock", connection: savedConnection, session: { vault, key } });
    } catch (error) {
      queryClient.removeQueries({ queryKey: ["vault", savedConnection.sessionId] });
      await lockDeviceCredential().catch(() => undefined);
      throw error;
    }
  }

  async function completeUnlock(vault: VaultRecord, passphrase: string) {
    if (!connection) {
      throw new Error("The API connection was lost. Enter your token and try again.");
    }
    if (hasDeviceCredential.data) {
      try {
        await forgetDeviceCredential.mutateAsync();
      } finally {
        forgetDeviceCredential.reset();
      }
    }
    const key = await unlockVault(vault.document, passphrase);
    try {
      await saveDeviceCredential.mutateAsync({ token: connection.token, passphrase });
    } finally {
      saveDeviceCredential.reset();
    }
    dispatch({ type: "unlock", connection, session: { vault, key } });
  }

  async function forgetDevice() {
    try {
      await forgetDeviceCredential.mutateAsync();
    } finally {
      forgetDeviceCredential.reset();
    }
    dispatch({ type: "disconnect", entry: "manual-token" });
  }

  const value: VaultContextValue = {
    isManualTokenEntryRequested,
    connection,
    session,
    hasDeviceCredential,
    accessMode,
    connect: (nextConnection) => dispatch({ type: "connect", connection: nextConnection }),
    disconnect,
    completeUnlock,
    openSavedVault,
    requestManualTokenEntry: () => dispatch({ type: "request-manual-token" }),
    forgetDevice,
    startRecovery: () => dispatch({ type: "start-recovery" }),
    cancelRecovery: () => dispatch({ type: "cancel-recovery" }),
    lock,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
