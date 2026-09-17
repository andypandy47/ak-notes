import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, PageSummary, commonResponses, json, security } from "../../types";
import { listPages } from "../pages-service";

export class PageList extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "List page metadata (titles remain encrypted)",
    security,
    responses: {
      ...commonResponses,
      "200": {
        description: "Page metadata, ordered by opaque ID; this is not a sync feed",
        ...json(
          z.object({
            success: z.literal(true),
            pages: PageSummary.array(),
          }),
        ),
      },
    },
  };
  async handle(c: AppContext) {
    return c.json({
      success: true,
      pages: await listPages(c.env.DB, c.get("ownerId")),
    });
  }
}
