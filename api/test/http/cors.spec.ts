import { describe, expect, it } from "vitest";
import { apiRequest } from "../helpers/api-client";

const tauriOrigin = "http://tauri.localhost";

describe("CORS", () => {
  it("accepts preflight requests from the packaged Tauri app", async () => {
    const response = await apiRequest({
      path: "/api/v1/vaults",
      method: "OPTIONS",
      headers: {
        Origin: tauriOrigin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(tauriOrigin);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization,Content-Type");
  });

  it("adds CORS headers to API responses for the packaged Tauri app", async () => {
    const response = await apiRequest({
      path: "/api/v1/vaults",
      headers: { Origin: tauriOrigin },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(tauriOrigin);
  });

  it("does not allow untrusted web origins", async () => {
    const response = await apiRequest({
      path: "/api/v1/vaults",
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});
