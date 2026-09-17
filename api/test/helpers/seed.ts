import { env } from "cloudflare:workers";
import type { VaultDocument } from "../../src/types";
import { createApiTokenId, createUserId } from "../../src/ids";
import { validToken } from "../factories/auth";

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const resetDatabase = async (): Promise<void> => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM pages"),
    env.DB.prepare("DELETE FROM vaults"),
    env.DB.prepare("DELETE FROM api_tokens"),
    env.DB.prepare("DELETE FROM users"),
  ]);
};

export const seedAuthenticatedUser = async (
  name = "personal",
): Promise<{ ownerId: string; token: string }> => {
  const ownerId = createUserId();
  const token = validToken();
  await env.DB.prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)")
    .bind(ownerId, name, Date.now())
    .run();
  await env.DB.prepare(
    "INSERT INTO api_tokens (id, user_id, label, token_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(createApiTokenId(), ownerId, "test", await sha256(token), Date.now())
    .run();
  return { ownerId, token };
};

export const seedVault = async (ownerId: string, document: VaultDocument): Promise<void> => {
  await env.DB.prepare("INSERT INTO vaults (id, owner_id, revision, document) VALUES (?, ?, 1, ?)")
    .bind(document.id, ownerId, JSON.stringify(document))
    .run();
};

export const seedPage = async (input: {
  id: string;
  vaultId: string;
  envelope: unknown;
  summaryEnvelope?: unknown;
}): Promise<void> => {
  await env.DB.prepare(
    "INSERT INTO pages (id, vault_id, revision, updated_at, envelope, summary_envelope) VALUES (?, ?, 1, ?, ?, ?)",
  )
    .bind(
      input.id,
      input.vaultId,
      new Date().toISOString(),
      JSON.stringify(input.envelope),
      input.summaryEnvelope === undefined ? null : JSON.stringify(input.summaryEnvelope),
    )
    .run();
};
