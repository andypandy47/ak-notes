import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { apiRequest } from "../helpers/api-client";
import { seedAuthenticatedUser } from "../helpers/seed";

describe("authentication middleware", () => {
  it("rejects a missing bearer token", async () => {
    const response = await apiRequest({ path: "/api/v1/pages" });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("rejects an unknown bearer token", async () => {
    const response = await apiRequest({ path: "/api/v1/pages", token: "x".repeat(43) });
    expect(response.status).toBe(401);
  });

  it("fails closed when authentication storage is unavailable", async () => {
    const actor = await seedAuthenticatedUser();
    await env.DB.prepare("DROP TABLE api_tokens").run();
    const response = await apiRequest({ path: "/api/v1/pages", token: actor.token });
    expect(response.status).toBe(503);
  });
});
