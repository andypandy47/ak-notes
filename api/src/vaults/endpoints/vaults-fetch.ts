import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  type AppContext,
  ErrorBody,
  VaultRecord,
  VaultParams,
  commonResponses,
  json,
  security,
} from "../../types";
import { fetchVault } from "../vaults-service";
export class VaultFetch extends OpenAPIRoute {
  schema = {
    tags: ["Vault"],
    summary: "Fetch the authenticated owner's encrypted vault key wrappers",
    security,
    request: { params: VaultParams },
    responses: {
      ...commonResponses,
      "200": {
        description: "Encrypted key material; unlocking happens on the client",
        ...json(z.object({ success: z.literal(true), vault: VaultRecord })),
      },
      "404": { description: "Vault has not been created", ...json(ErrorBody) },
    },
  };
  async handle(c: AppContext) {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const vault = await fetchVault(c.env.DB, c.get("ownerId"), params.vaultId);
    return vault
      ? c.json({ success: true, vault })
      : c.json({ success: false, error: "Vault not found" }, 404);
  }
}
