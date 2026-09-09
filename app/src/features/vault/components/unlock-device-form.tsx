import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { unlockVaultSchema, type UnlockVaultValues } from "../form-schemas";
import { useVault } from "../hooks/use-vault";
import { VaultPanel } from "./vault-panel";

export function UnlockDeviceForm() {
  const { openSavedVault, forgetDevice, requestManualTokenEntry } = useVault();

  const form = useForm<UnlockVaultValues>({
    resolver: zodResolver(unlockVaultSchema),
    defaultValues: { passphrase: "" },
  });

  async function onSubmit({ passphrase }: UnlockVaultValues) {
    form.clearErrors("root");
    try {
      await openSavedVault(passphrase);
      form.reset();
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : "Could not unlock this device.",
      });
    }
  }

  async function forget() {
    form.clearErrors("root");
    try {
      await forgetDevice();
    } catch {
      form.setError("root.server", {
        message: "Could not forget the saved device credential. Close the app and try again.",
      });
    }
  }

  return (
    <VaultPanel
      title="Welcome back"
      description="Enter your passphrase to unlock this device and open your vault."
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button
            variant="ghost"
            disabled={form.formState.isSubmitting}
            onClick={requestManualTokenEntry}
          >
            Use API token
          </Button>
          <Button
            variant="ghost"
            disabled={form.formState.isSubmitting}
            onClick={() => void forget()}
          >
            Forget this device
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
                <FieldLabel htmlFor="device-passphrase">Passphrase</FieldLabel>
                <Input
                  {...field}
                  id="device-passphrase"
                  type="password"
                  autoComplete="current-password"
                  spellCheck={false}
                  readOnly={form.formState.isSubmitting}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "device-passphrase-error" : undefined}
                />
                {fieldState.error && (
                  <FieldError id="device-passphrase-error" errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          {form.formState.errors.root?.server && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Unlocking securely…" : "Unlock vault"}
          </Button>
        </FieldGroup>
      </form>
    </VaultPanel>
  );
}
