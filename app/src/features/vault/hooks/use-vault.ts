import { useContext } from "react";
import { VaultContext } from "../context/vault-context";

export function useVault() {
  const vault = useContext(VaultContext);
  if (!vault) {
    throw new Error("useVault must be used within VaultProvider");
  }
  return vault;
}
