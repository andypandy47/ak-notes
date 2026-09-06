import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, PageMetadata, commonResponses, json, security } from "../../types";
import { listPages } from "../pages-service";

export class PageList extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "List page metadata (titles remain encrypted)",
    security,
    request: {
      query: z.object({
        after: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
    },
    responses: {
      ...commonResponses,
      "200": {
        description: "Page metadata, ordered by opaque ID; this is not a sync feed",
        ...json(
          z.object({
            success: z.literal(true),
            pages: PageMetadata.array(),
            nextCursor: z.uuid().nullable(),
          }),
        ),
      },
    },
  };
  async handle(c: AppContext) {
    const { query } = await this.getValidatedData<typeof this.schema>();
    return c.json({
      success: true,
      ...(await listPages(c.env.DB, query.after ?? "", query.limit)),
    });
  }
}
