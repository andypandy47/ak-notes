import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCreateVaultMutation, type VaultConnection } from "../api/vault";
import { createVault } from "../crypto";
import { createVaultSchema, type CreateVaultValues } from "../form-schemas";
import type { VaultSession } from "../types";
import { RecoveryBackup } from "./recovery-backup";
import { VaultPanel } from "./vault-panel";

export function CreateVaultForm({
  connection,
  onUnlocked,
  disconnect,
}: {
  connection: VaultConnection;
  onUnlocked: (session: VaultSession) => void;
  disconnect: () => void;
}) {
  const mutation = useCreateVaultMutation(connection);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof createVault>> | null>(null);
  const form = useForm<CreateVaultValues>({
    resolver: zodResolver(createVaultSchema),
    defaultValues: { passphrase: "", confirm: "" },
  });

  async function onSubmit({ passphrase }: CreateVaultValues) {
    form.clearErrors("root");
    try {
      setDraft(await createVault(passphrase));
      form.reset();
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : "Could not complete the vault operation.",
      });
    }
  }

  if (draft) {
    return (
      <RecoveryBackup
        recoveryKey={draft.recoveryKey}
        onSave={async () => {
          const vault = await mutation.mutateAsync(draft.document);
          onUnlocked({ vault, key: draft.key });
        }}
      />
    );
  }

  return (
    <VaultPanel
      title="Create your vault"
      description="Choose a passphrase to protect your notebook. Encryption and unlocking happen on this device."
      footer={
        <Button variant="ghost" onClick={disconnect} disabled={form.formState.isSubmitting}>
          Disconnect
        </Button>
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
            {form.formState.isSubmitting ? "Working securely…" : "Create vault"}
          </Button>
        </FieldGroup>
      </form>
    </VaultPanel>
  );
}
