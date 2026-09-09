import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  type AppContext,
  ErrorBody,
  PassphraseKey,
  VaultRecord,
  VaultParams,
  commonResponses,
  json,
  security,
} from "../../types";
import { updatePassphrase } from "../vaults-service";
export class VaultPassphrase extends OpenAPIRoute {
  schema = {
    tags: ["Vault"],
    summary: "Replace the passphrase wrapper after client-side recovery",
    security,
    request: {
      params: VaultParams,
      body: json(
        z.strictObject({
          expectedRevision: z
            .number()
            .int()
            .positive()
            .max(Number.MAX_SAFE_INTEGER - 1),
          passphrase: PassphraseKey,
        }),
      ),
    },
    responses: {
      ...commonResponses,
      "200": {
        description: "Passphrase wrapper replaced; vault and recovery keys unchanged",
        ...json(z.object({ success: z.literal(true), vault: VaultRecord })),
      },
      "409": {
        description: "Vault missing or revision changed; fetch again before recovery",
        ...json(ErrorBody),
      },
    },
  };
  async handle(c: AppContext) {
    const { params, body } = await this.getValidatedData<typeof this.schema>();
    const vault = await updatePassphrase(
      c.env.DB,
      c.get("ownerId"),
      params.vaultId,
      body.expectedRevision,
      body.passphrase,
    );
    return vault
      ? c.json({ success: true, vault })
      : c.json({ success: false, error: "Vault revision conflict" }, 409);
  }
}
