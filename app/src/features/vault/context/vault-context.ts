import type { UseQueryResult } from "@tanstack/react-query";
import { createContext } from "react";
import type { VaultConnection } from "../api/vault";
import type { VaultRecord, VaultSession } from "../types";

export type VaultAccessMode = "unlock" | "recover";

export type VaultContextValue = {
  hasDeviceCredential: UseQueryResult<boolean, Error>;
  isManualTokenEntryRequested: boolean;
  connection: VaultConnection | null;
  session: VaultSession | null;
  connect: (connection: VaultConnection) => void;
  disconnect: () => void;
  completeUnlock: (vault: VaultRecord, passphrase: string) => Promise<void>;
  openSavedVault: (passphrase: string) => Promise<void>;
  requestManualTokenEntry: () => void;
  forgetDevice: () => Promise<void>;
  accessMode: VaultAccessMode;
  startRecovery: () => void;
  cancelRecovery: () => void;
  lock: () => void;
};

export const VaultContext = createContext<VaultContextValue | null>(null);
