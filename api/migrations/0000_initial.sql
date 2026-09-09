CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "api_tokens_hash_valid" CHECK(length("api_tokens"."token_hash") = 64 AND "api_tokens"."token_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "api_tokens_expiry_after_creation" CHECK("api_tokens"."expires_at" IS NULL OR "api_tokens"."expires_at" > "api_tokens"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_tokens_user_id` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`envelope` text NOT NULL,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pages_revision_positive" CHECK("pages"."revision" > 0),
	CONSTRAINT "pages_envelope_valid" CHECK(json_valid("pages"."envelope"))
);
--> statement-breakpoint
CREATE INDEX `pages_vault_id_id` ON `pages` (`vault_id`,`id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vaults_revision_positive" CHECK("vaults"."revision" > 0),
	CONSTRAINT "vaults_document_valid" CHECK(json_valid("vaults"."document")),
	CONSTRAINT "vaults_document_id_matches" CHECK(json_extract("vaults"."document", '$.id') IS "vaults"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vaults_owner_id_unique` ON `vaults` (`owner_id`);