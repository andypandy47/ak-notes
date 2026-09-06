import { randomBytes, createHash } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

if (existsSync(".dev.vars") || existsSync(".dev.token")) {
  throw new Error(
    "Local credentials already exist. Preserve them; this command does not overwrite credentials.",
  );
}
const token = randomBytes(32).toString("base64url");
writeFileSync(".dev.token", token + "\n", { flag: "wx", mode: 0o600 });
writeFileSync(
  ".dev.vars",
  "API_TOKEN_SHA256=" + createHash("sha256").update(token).digest("hex") + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Local credentials created. Use the token from .dev.token in the API documentation's Authorize dialog. Both files are ignored by Git.",
);
