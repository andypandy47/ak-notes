import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  type AppContext,
  ErrorBody,
  VaultDocument,
  VaultRecord,
  commonResponses,
  json,
  security,
} from "../../types";
import { createVault } from "../vaults-service";
export class VaultCreate extends OpenAPIRoute {
  schema = {
    tags: ["Vault"],
    summary: "Create the single vault once using client-encrypted key wrappers",
    security,
    request: { body: json(VaultDocument) },
    responses: {
      ...commonResponses,
      "201": {
        description: "Vault created",
        ...json(z.object({ success: z.literal(true), vault: VaultRecord })),
      },
      "409": {
        description: "A vault already exists; it will not be overwritten",
        ...json(ErrorBody),
      },
    },
  };
  async handle(c: AppContext) {
    const { body } = await this.getValidatedData<typeof this.schema>();
    const vault = await createVault(c.env.DB, body);
    return vault
      ? c.json({ success: true, vault }, 201)
      : c.json({ success: false, error: "Vault already exists" }, 409);
  }
}
