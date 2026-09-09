import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, VaultRecord, commonResponses, json, security } from "../../types";
import { listVaults } from "../vaults-service";

export class VaultList extends OpenAPIRoute {
  schema = {
    tags: ["Vault"],
    summary: "Discover the authenticated owner's vault",
    security,
    responses: {
      ...commonResponses,
      "200": {
        description: "Owned vaults; currently zero or one per owner",
        ...json(z.object({ success: z.literal(true), vaults: VaultRecord.array() })),
      },
    },
  };
  async handle(c: AppContext) {
    return c.json({ success: true, vaults: await listVaults(c.env.DB, c.get("ownerId")) });
  }
}
