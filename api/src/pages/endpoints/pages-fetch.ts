import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  type AppContext,
  Page,
  PageParams,
  ErrorBody,
  commonResponses,
  json,
  security,
} from "../../types";
import { fetchPage } from "../pages-service";

export class PageFetch extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Fetch an encrypted page",
    security,
    request: { params: PageParams },
    responses: {
      ...commonResponses,
      "200": {
        description: "Encrypted page and server revision",
        ...json(z.object({ success: z.literal(true), page: Page })),
      },
      "404": { description: "Page not found", ...json(ErrorBody) },
    },
  };
  async handle(c: AppContext) {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const page = await fetchPage(c.env.DB, c.get("ownerId"), params.pageId);
    return page
      ? c.json({ success: true, page })
      : c.json({ success: false, error: "Page not found" }, 404);
  }
}
