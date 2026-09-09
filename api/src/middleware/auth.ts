import { createMiddleware } from "hono/factory";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { createDb } from "../db/client";
import { apiTokens } from "../db/schema";
import type { AppEnvironment } from "../types";

export const authenticate = createMiddleware<AppEnvironment>(async (c, next) => {
  c.header("Cache-Control", "no-store");

  const authorization = c.req.header("Authorization") ?? "";

  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/i.exec(authorization);
  if (!match) {
    c.header("WWW-Authenticate", "Bearer");
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1]));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  let credential: { userId: string } | undefined;
  try {
    credential = await createDb(c.env.DB)
      .select({ userId: apiTokens.userId })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenHash, hash),
          isNull(apiTokens.revokedAt),
          or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, Date.now())),
        ),
      )
      .get();
  } catch {
    return c.json({ success: false, error: "Authentication storage unavailable" }, 503);
  }
  if (!credential) {
    c.header("WWW-Authenticate", "Bearer");
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  c.set("ownerId", credential.userId);
  await next();
});
