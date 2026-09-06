import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { VaultPanel } from "./vault-panel";

export function RecoveryBackup({
  recoveryKey,
  onSave,
}: {
  recoveryKey: string;
  onSave: () => Promise<void>;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const form = useForm<{}>({
    resolver: zodResolver(z.object({})),
    defaultValues: {},
  });

  async function copyRecoveryKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  async function onSubmit() {
    form.clearErrors("root");
    try {
      await onSave();
      form.reset();
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof Error ? error.message : "Could not complete the vault operation.",
      });
    }
  }
  return (
    <VaultPanel
      title="Save your recovery key"
      description="Store this key in your password manager or another safe place. Anyone with it and the encrypted vault data can unlock your notes."
      footer={
        <p className="text-sm text-muted-foreground">
          Losing both your passphrase and recovery key means losing access. This key is shown only
          during setup.
        </p>
      }
    >
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        aria-busy={form.formState.isSubmitting}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="backup">Recovery key</FieldLabel>
            <Input id="backup" value={recoveryKey} readOnly autoComplete="off" spellCheck={false} />
            <Button type="button" variant="outline" onClick={() => void copyRecoveryKey()}>
              {copyStatus === "copied" ? "Copied" : "Copy recovery key"}
            </Button>
            <FieldDescription role="status" aria-live="polite">
              {copyStatus === "copied" && "Recovery key copied to clipboard."}
              {copyStatus === "error" &&
                "Could not copy automatically. Select the key and copy it manually."}
            </FieldDescription>
            <FieldDescription>
              The vault will be saved after you confirm this backup.
            </FieldDescription>
          </Field>
          {form.formState.errors.root?.server && (
            <FieldError>{form.formState.errors.root.server.message}</FieldError>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving vault…" : "I saved my key — finish setup"}
          </Button>
        </FieldGroup>
      </form>
    </VaultPanel>
  );
}
