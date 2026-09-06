import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { connectVaultSchema, type ConnectVaultValues } from "../form-schemas";
import type { VaultConnection } from "../api/vault";
import { VaultPanel } from "./vault-panel";

export function ConnectVaultForm({
  onConnect,
}: {
  onConnect: (connection: VaultConnection) => void;
}) {
  const form = useForm<ConnectVaultValues>({
    resolver: zodResolver(connectVaultSchema),
    defaultValues: { token: "" },
  });

  function onSubmit({ token }: ConnectVaultValues) {
    form.clearErrors("root");
    try {
      onConnect({ token, sessionId: crypto.randomUUID() });
      form.reset();
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : "Could not complete the vault operation.",
      });
    }
  }

  return (
    <VaultPanel
      title="Your private notebook"
      description="Connect to your local API to create or unlock your vault."
      footer={
        <p className="text-sm text-muted-foreground">
          Your API token permits access to storage. Your passphrase unlocks it. Both stay in memory
          for this session.
        </p>
      }
    >
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        aria-busy={form.formState.isSubmitting}
      >
        <FieldGroup>
          <Controller
            name="token"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="token">Local API token</FieldLabel>
                <Input
                  {...field}
                  id="token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={form.formState.isSubmitting}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.error ? "token-description token-error" : "token-description"
                  }
                />
                <FieldDescription id="token-description">
                  Use the token from api/.dev.token, created by the local setup command.
                </FieldDescription>
                {fieldState.error && <FieldError id="token-error" errors={[fieldState.error]} />}
              </Field>
            )}
          />
          {form.formState.errors.root?.server && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Working securely…" : "Connect"}
          </Button>
        </FieldGroup>
      </form>
    </VaultPanel>
  );
}
