import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { URL } from "node:url";
import { openDatabase, importPersonalToken } from "./tokens.mts";

const { values } = parseArgs({
  options: {
    remote: { type: "boolean" },
    env: { type: "string" },
    "token-file": { type: "string" },
  },
});
if (!values.remote && values.env) throw new Error("--env can only be used with --remote.");

const tokenPath = values["token-file"]
  ? resolve(values["token-file"])
  : new URL("../.dev.token", import.meta.url);
const target = values.remote ? `remote ${values.env ?? "production"}` : "local";
const proxy = await openDatabase({ remote: values.remote, environment: values.env });
try {
  // Check migrations before generating or reading a credential.
  await proxy.env.DB.prepare("SELECT id FROM api_tokens LIMIT 1").all();
  if (!existsSync(tokenPath)) {
    writeFileSync(tokenPath, randomBytes(32).toString("base64url") + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  }
  const id = await importPersonalToken(
    proxy.env.DB,
    readFileSync(tokenPath, "utf8").trim(),
    values.remote ? "Personal remote token" : "Personal local token",
  );
  console.log(`Personal token registered in ${target} D1 (${id}). Its contents were not printed.`);
} finally {
  await proxy.dispose();
}
