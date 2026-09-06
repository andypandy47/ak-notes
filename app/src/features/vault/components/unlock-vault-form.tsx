import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useVaultQuery, type VaultConnection } from "../api/vault";
import { unlockVault } from "../crypto";
import { unlockVaultSchema, type UnlockVaultValues } from "../form-schemas";
import type { VaultSession } from "../types";
import { VaultPanel } from "./vault-panel";

export function UnlockVaultForm({
  connection,
  onUnlocked,
  disconnect,
  onRecover,
}: {
  connection: VaultConnection;
  onUnlocked: (session: VaultSession) => void;
  disconnect: () => void;
  onRecover: () => void;
}) {
  const form = useForm<UnlockVaultValues>({
    resolver: zodResolver(unlockVaultSchema),
    defaultValues: { passphrase: "" },
  });
  const query = useVaultQuery(connection);
  async function onSubmit({ passphrase }: UnlockVaultValues) {
    form.clearErrors("root");
    try {
      const { data: vault } = await query.refetch({ throwOnError: true });
      if (!vault) {
        throw new Error("The vault could not be found. Reconnect to check its state.");
      }
      const key = await unlockVault(vault.document, passphrase);
      onUnlocked({ vault, key });
      form.reset();
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : "Could not complete the vault operation.",
      });
    }
  }
  return (
    <VaultPanel
      title="Welcome back"
      description="Enter your passphrase to unlock your vault on this device."
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button variant="ghost" disabled={form.formState.isSubmitting} onClick={disconnect}>
            Disconnect
          </Button>
          <Button variant="ghost" disabled={form.formState.isSubmitting} onClick={onRecover}>
            Use recovery key
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
            name="passphrase"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="passphrase">Passphrase</FieldLabel>
                <Input
                  {...field}
                  id="passphrase"
                  type="password"
                  autoComplete="current-password"
                  spellCheck={false}
                  readOnly={form.formState.isSubmitting}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "passphrase-error" : undefined}
                />

                {fieldState.error && (
                  <FieldError id="passphrase-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          {form.formState.errors.root?.server && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Working securely…" : "Unlock vault"}
          </Button>
        </FieldGroup>
      </form>
    </VaultPanel>
  );
}
