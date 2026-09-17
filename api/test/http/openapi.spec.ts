import { describe, expect, it } from "vitest";
import { apiRequest, responseJson } from "../helpers/api-client";

describe("OpenAPI contract", () => {
  it("documents bearer security on every protected operation", async () => {
    const spec = await responseJson<{
      info: { title: string };
      paths: Record<string, Record<string, { security?: unknown; parameters?: unknown[] }>>;
      components: { securitySchemes: { bearerAuth: { scheme: string } } };
    }>(await apiRequest({ path: "/openapi.json" }));
    expect(spec.info.title).toBe("AK Notes API");
    for (const [path, method] of [
      ["/api/v1/pages", "get"],
      ["/api/v1/pages/{pageId}", "get"],
      ["/api/v1/pages/{pageId}", "put"],
      ["/api/v1/vaults", "get"],
      ["/api/v1/vaults", "post"],
      ["/api/v1/vaults/{vaultId}", "get"],
      ["/api/v1/vaults/{vaultId}/passphrase", "put"],
    ] as const)
      expect(spec.paths[path]?.[method]?.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });

  it("exposes only current plural vault and page paths", async () => {
    const spec = await responseJson<{ paths: Record<string, unknown> }>(
      await apiRequest({ path: "/openapi.json" }),
    );
    expect(spec.paths).not.toHaveProperty("/api/v1/vault");
    expect(spec.paths).not.toHaveProperty("/api/v1/vault/passphrase");
    expect(JSON.stringify(spec.paths)).not.toContain("/api/tasks");
  });

  it("requires the vault identifier on passphrase updates", async () => {
    const spec = await responseJson<{
      paths: Record<
        string,
        Record<string, { parameters?: Array<{ name: string; in: string; required?: boolean }> }>
      >;
    }>(await apiRequest({ path: "/openapi.json" }));
    expect(spec.paths["/api/v1/vaults/{vaultId}/passphrase"]?.put?.parameters).toContainEqual(
      expect.objectContaining({ name: "vaultId", in: "path", required: true }),
    );
  });
});
