import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../types";

export const authenticate = createMiddleware<{ Bindings: AppBindings }>(async (c, next) => {
  c.header("Cache-Control", "no-store");

  const expected = c.env.API_TOKEN_SHA256;

  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    return c.json({ success: false, error: "API authentication is not configured" }, 503);
  }

  const authorization = c.req.header("Authorization") ?? "";

  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/i.exec(authorization);
  if (!match) {
    c.header("WWW-Authenticate", "Bearer");
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1]));
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference !== 0) {
    c.header("WWW-Authenticate", "Bearer");
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  await next();
});
