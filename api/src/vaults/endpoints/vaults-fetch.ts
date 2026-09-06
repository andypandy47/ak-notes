import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  type AppContext,
  ErrorBody,
  VaultRecord,
  commonResponses,
  json,
  security,
} from "../../types";
import { fetchVault } from "../vaults-service";
export class VaultFetch extends OpenAPIRoute {
  schema = {
    tags: ["Vault"],
    summary: "Fetch encrypted vault key wrappers",
    security,
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
    const vault = await fetchVault(c.env.DB);
    return vault
      ? c.json({ success: true, vault })
      : c.json({ success: false, error: "Vault not found" }, 404);
  }
}
