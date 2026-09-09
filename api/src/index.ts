import { fromHono } from "chanfana";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import type { AppEnvironment } from "./types";
import { authenticate } from "./middleware/auth";
import { PageFetch } from "./pages/endpoints/pages-fetch";
import { PageList } from "./pages/endpoints/pages-list";
import { PageSave } from "./pages/endpoints/pages-save";

import { VaultList } from "./vaults/endpoints/vaults-list";
import { VaultFetch } from "./vaults/endpoints/vaults-fetch";
import { VaultCreate } from "./vaults/endpoints/vaults-create";
import { VaultPassphrase } from "./vaults/endpoints/vaults-passphrase";

const app = new Hono<AppEnvironment>();
app.use("/api/*", authenticate);
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ success: false, error: "Request too large" }, 413),
  }),
);
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "AK Notes API",
      version: "0.1.0",
      description:
        "Owner-scoped encrypted storage with one vault per user. Each bearer token identifies its owner; revoked and expired tokens are rejected. Clients cannot select another owner. The client encrypts titles and blocks; this API never receives decryption keys. Not a complete synchronization protocol.",
    },
  },
});
openapi.registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "API access token, separate from the vault key",
});
openapi.get("/api/v1/pages", PageList);
openapi.get("/api/v1/pages/:pageId", PageFetch);
openapi.put("/api/v1/pages/:pageId", PageSave);
openapi.get("/api/v1/vaults", VaultList);
openapi.get("/api/v1/vaults/:vaultId", VaultFetch);
openapi.post("/api/v1/vaults", VaultCreate);
openapi.put("/api/v1/vaults/:vaultId/passphrase", VaultPassphrase);
app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }
  if (error instanceof SyntaxError) {
    return c.json({ success: false, error: "Invalid JSON" }, 400);
  }
  return c.json({ success: false, error: "Internal server error" }, 500);
});
export default app;
