import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { z } from "zod";
import type { Envelope, VaultDocument } from "../types";

type StoredEnvelope = z.infer<typeof Envelope>;

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const vaults = sqliteTable(
  "vaults",
  {
    id: text("id").primaryKey().notNull(),
    ownerId: text("owner_id")
      .notNull()
      .unique()
      .references(() => users.id),
    revision: integer("revision").notNull(),
    document: text("document", { mode: "json" }).$type<VaultDocument>().notNull(),
  },
  (table) => [
    check("vaults_revision_positive", sql`${table.revision} > 0`),
    check("vaults_document_valid", sql`json_valid(${table.document})`),
    check(
      "vaults_document_id_matches",
      sql`json_extract(${table.document}, '$.id') IS ${table.id}`,
    ),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey().notNull(),
    vaultId: text("vault_id")
      .notNull()
      .references(() => vaults.id),
    revision: integer("revision").notNull(),
    updatedAt: text("updated_at").notNull(),
    envelope: text("envelope", { mode: "json" }).$type<StoredEnvelope>().notNull(),
  },
  (table) => [
    check("pages_revision_positive", sql`${table.revision} > 0`),
    check("pages_envelope_valid", sql`json_valid(${table.envelope})`),
    index("pages_vault_id_id").on(table.vaultId, table.id),
  ],
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),
    revokedAt: integer("revoked_at"),
  },
  (table) => [
    check(
      "api_tokens_hash_valid",
      sql`length(${table.tokenHash}) = 64 AND ${table.tokenHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "api_tokens_expiry_after_creation",
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.createdAt}`,
    ),
    index("api_tokens_user_id").on(table.userId),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  tokens: many(apiTokens),
  vault: one(vaults),
}));

export const vaultsRelations = relations(vaults, ({ many, one }) => ({
  owner: one(users, { fields: [vaults.ownerId], references: [users.id] }),
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  vault: one(vaults, { fields: [pages.vaultId], references: [vaults.id] }),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, { fields: [apiTokens.userId], references: [users.id] }),
}));

export const schema = { users, vaults, pages, apiTokens };
