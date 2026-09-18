import { invoke, isTauri } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { Stronghold, type Client } from "@tauri-apps/plugin-stronghold";
import { deviceTokenSchema } from "./form-schemas";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/environment";

const CLIENT_NAME = "aknotes";
const TOKEN_RECORD = "api-token";
const SNAPSHOT_FILE =
  env.VITE_APP_ENV === "production" ? "credential.hold" : `credential-${env.VITE_APP_ENV}.hold`;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

let activeStronghold: Stronghold | null = null;

const deviceCredentialKey = ["device-credential", env.VITE_APP_ENV] as const;

async function lockSilently() {
  try {
    await lockDeviceCredential();
  } catch {
    // The caller still clears all webview references to the credential.
  }
}

async function snapshotPath() {
  return join(await appLocalDataDir(), SNAPSHOT_FILE);
}

async function loadClient(stronghold: Stronghold): Promise<Client> {
  try {
    return await stronghold.loadClient(CLIENT_NAME);
  } catch {
    return stronghold.createClient(CLIENT_NAME);
  }
}

export const deviceCredentialQueryOptions = () =>
  queryOptions({
    queryKey: deviceCredentialKey,
    queryFn: hasDeviceCredential,
  });

export const useHasDeviceCredential = () => useQuery(deviceCredentialQueryOptions());

export function useUnlockDeviceCredentialMutation() {
  return useMutation({
    mutationKey: [...deviceCredentialKey, "unlock"],
    mutationFn: unlockDeviceCredential,
    gcTime: 0,
    retry: false,
  });
}

export function useSaveDeviceCredentialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...deviceCredentialKey, "save"],
    mutationFn: ({ token, passphrase }: { token: string; passphrase: string }) =>
      saveDeviceCredential(token, passphrase),
    onSuccess: (saved) => queryClient.setQueryData(deviceCredentialKey, saved),
    gcTime: 0,
    retry: false,
  });
}

export function useForgetDeviceCredentialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...deviceCredentialKey, "forget"],
    mutationFn: forgetDeviceCredential,
    onSuccess: () => queryClient.setQueryData(deviceCredentialKey, false),
    gcTime: 0,
    retry: false,
  });
}

export async function hasDeviceCredential() {
  if (!isTauri()) {
    return false;
  }
  return invoke<boolean>("has_device_credential", { environment: env.VITE_APP_ENV });
}

export async function unlockDeviceCredential(passphrase: string) {
  if (!isTauri()) {
    throw new Error("Saved device credentials are available in the installed app.");
  }
  try {
    const stronghold = await Stronghold.load(await snapshotPath(), passphrase);
    activeStronghold = stronghold;
    const client = await stronghold.loadClient(CLIENT_NAME);
    const bytes = await client.getStore().get(TOKEN_RECORD);
    if (!bytes) {
      throw new Error("Missing device credential");
    }
    try {
      return deviceTokenSchema.parse(decoder.decode(bytes));
    } finally {
      bytes.fill(0);
    }
  } catch {
    await lockSilently();
    throw new Error("Could not unlock this device. Check your passphrase and try again.");
  }
}

export async function saveDeviceCredential(token: string, passphrase: string) {
  if (!isTauri()) {
    return false;
  }
  try {
    const stronghold = await Stronghold.load(await snapshotPath(), passphrase);
    activeStronghold = stronghold;
    const client = await loadClient(stronghold);
    const bytes = encoder.encode(deviceTokenSchema.parse(token));
    try {
      await client.getStore().insert(TOKEN_RECORD, Array.from(bytes));
      await stronghold.save();
    } finally {
      bytes.fill(0);
    }
    return true;
  } catch {
    await lockSilently();
    throw new Error("Could not securely save the device credential. Try again.");
  }
}

export async function lockDeviceCredential() {
  const stronghold = activeStronghold;
  activeStronghold = null;
  if (stronghold) {
    await stronghold.unload();
  }
}

export async function forgetDeviceCredential() {
  await lockDeviceCredential();
  if (isTauri()) {
    await invoke("remove_device_credential", { environment: env.VITE_APP_ENV });
  }
}
