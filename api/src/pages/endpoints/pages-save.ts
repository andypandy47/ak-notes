import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  type AppContext,
  Page,
  PageParams,
  SavePage,
  ErrorBody,
  commonResponses,
  json,
  security,
} from "../../types";
import { savePage } from "../pages-service";

const result = json(z.object({ success: z.literal(true), page: Page }));
export class PageSave extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Create or replace an encrypted page with a revision check",
    security,
    request: { params: PageParams, body: json(SavePage) },
    responses: {
      ...commonResponses,
      "200": { description: "Page replaced", ...result },
      "201": { description: "Page created", ...result },
      "409": {
        description:
          "Revision mismatch, page missing, or no owned vault with this key; fetch and reconcile before retrying",
        ...json(ErrorBody),
      },
      "413": { description: "Request exceeds 1 MiB", ...json(ErrorBody) },
    },
  };
  async handle(c: AppContext) {
    const { params, body } = await this.getValidatedData<typeof this.schema>();
    const page = await savePage(c.env.DB, c.get("ownerId"), params.pageId, body);
    if (!page) {
      return c.json({ success: false, error: "Revision conflict or vault/key unavailable" }, 409);
    }
    return c.json({ success: true, page }, body.expectedRevision === 0 ? 201 : 200);
  }
}
