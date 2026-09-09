import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { URL } from "node:url";
import { openLocalDatabase, importPersonalToken } from "./tokens.mts";

const tokenPath = new URL("../.dev.token", import.meta.url);
const proxy = await openLocalDatabase();
try {
  // Check migrations before generating a credential. Preserve existing local access.
  await proxy.env.DB.prepare("SELECT id FROM api_tokens LIMIT 1").all();
  if (!existsSync(tokenPath)) {
    writeFileSync(tokenPath, randomBytes(32).toString("base64url") + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  }
  const id = await importPersonalToken(proxy.env.DB, readFileSync(tokenPath, "utf8").trim());
  console.log(
    `Personal token registered in local D1 (${id}). Use the existing api/.dev.token file. Its contents were not printed.`,
  );
} finally {
  await proxy.dispose();
}
