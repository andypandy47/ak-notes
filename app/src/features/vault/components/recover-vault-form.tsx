import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  useListVaultsQuery,
  useUpdateVaultPassphraseMutation,
  type VaultConnection,
} from "../api/vault";
import { recoverVault } from "../crypto";
import { recoverVaultSchema, type RecoverVaultValues } from "../form-schemas";
import { useVault } from "../hooks/use-vault";
import { VaultPanel } from "./vault-panel";

export function RecoverVaultForm({ connection }: { connection: VaultConnection }) {
  const form = useForm<RecoverVaultValues>({
    resolver: zodResolver(recoverVaultSchema),
    defaultValues: { passphrase: "", confirm: "", recovery: "" },
  });

  const { cancelRecovery, disconnect, completeUnlock } = useVault();

  const listVaults = useListVaultsQuery(connection);
  const updateVaultPassphrase = useUpdateVaultPassphraseMutation(connection);

  async function onSubmit({ passphrase, recovery }: RecoverVaultValues) {
    form.clearErrors("root");
    try {
      const vault = listVaults.data?.[0];

      if (!vault) {
        throw new Error("The vault could not be found. Reconnect to check its state.");
      }

      const recovered = await recoverVault(vault.document, recovery, passphrase);
      const updatedVault = await updateVaultPassphrase.mutateAsync({
        vaultId: vault.document.id,
        expectedRevision: vault.revision,
        passphrase: recovered.passphrase,
      });
      await completeUnlock(updatedVault, passphrase);
      form.reset();
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : "Could not complete the vault operation.",
      });
    }
  }

  return (
    <VaultPanel
      title="Recover your vault"
      description="Use your recovery key to set a new passphrase. Your vault key will remain the same."
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button variant="ghost" disabled={form.formState.isSubmitting} onClick={disconnect}>
            Disconnect
          </Button>
          <Button variant="ghost" disabled={form.formState.isSubmitting} onClick={cancelRecovery}>
            Back to unlock
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        aria-busy={form.formState.isSubmitting}
      >
        <FieldGroup>
          <Controller
            name="recovery"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="recovery">Recovery key</FieldLabel>
                <Input
                  {...field}
                  id="recovery"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={form.formState.isSubmitting}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "recovery-error" : undefined}
                />

                {fieldState.error && <FieldError id="recovery-error" errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="passphrase"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="passphrase">New passphrase</FieldLabel>
                <Input
                  {...field}
                  id="passphrase"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  readOnly={form.formState.isSubmitting}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.error
                      ? "passphrase-description passphrase-error"
                      : "passphrase-description"
                  }
                />
                <FieldDescription id="passphrase-description">
                  Use at least 6 characters. Several unrelated words make a good passphrase.
                </FieldDescription>
                {fieldState.error && (
                  <FieldError id="passphrase-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="confirm"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="confirm">Confirm passphrase</FieldLabel>
                <Input
                  {...field}
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  readOnly={form.formState.isSubmitting}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "confirm-error" : undefined}
                />

                {fieldState.error && <FieldError id="confirm-error" errors={[fieldState.error]} />}
              </Field>
            )}
          />
          {form.formState.errors.root?.server && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Working securely…" : "Recover and set passphrase"}
          </Button>
        </FieldGroup>
      </form>
    </VaultPanel>
  );
}
