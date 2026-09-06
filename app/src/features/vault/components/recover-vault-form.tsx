import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  useUpdateVaultPassphraseMutation,
  useVaultQuery,
  type VaultConnection,
} from "../api/vault";
import { recoverVault } from "../crypto";
import { recoverVaultSchema, type RecoverVaultValues } from "../form-schemas";
import type { VaultSession } from "../types";
import { VaultPanel } from "./vault-panel";

export function RecoverVaultForm({
  connection,
  onUnlocked,
  disconnect,
  onUnlock,
}: {
  connection: VaultConnection;
  onUnlocked: (session: VaultSession) => void;
  disconnect: () => void;
  onUnlock: () => void;
}) {
  const form = useForm<RecoverVaultValues>({
    resolver: zodResolver(recoverVaultSchema),
    defaultValues: { passphrase: "", confirm: "", recovery: "" },
  });
  const query = useVaultQuery(connection);
  const mutation = useUpdateVaultPassphraseMutation(connection);

  async function onSubmit({ passphrase, recovery }: RecoverVaultValues) {
    form.clearErrors("root");
    try {
      const { data: current } = await query.refetch({ throwOnError: true });

      if (!current) {
        throw new Error("The vault could not be found. Reconnect to check its state.");
      }

      const recovered = await recoverVault(current.document, recovery, passphrase);
      const vault = await mutation.mutateAsync({
        expectedRevision: current.revision,
        passphrase: recovered.passphrase,
      });
      onUnlocked({ vault, key: recovered.key });
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
          <Button variant="ghost" disabled={form.formState.isSubmitting} onClick={onUnlock}>
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
                  Use at least 15 characters. Several unrelated words make a good passphrase.
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
