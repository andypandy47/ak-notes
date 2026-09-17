PRAGMA defer_foreign_keys = true;
--> statement-breakpoint
DROP TABLE `pages`;
--> statement-breakpoint
DROP TABLE `vaults`;
--> statement-breakpoint
DROP TABLE `api_tokens`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "users_id_valid" CHECK(length(`id`) = 30 AND substr(`id`, 1, 4) = 'usr_' AND substr(`id`, 5, 1) GLOB '[0-7]' AND substr(`id`, 6) NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*')
);
--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vaults_id_valid" CHECK(length(`id`) = 30 AND substr(`id`, 1, 4) = 'vlt_' AND substr(`id`, 5, 1) GLOB '[0-7]' AND substr(`id`, 6) NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*'),
	CONSTRAINT "vaults_revision_positive" CHECK(`revision` > 0),
	CONSTRAINT "vaults_document_valid" CHECK(json_valid(`document`)),
	CONSTRAINT "vaults_document_id_matches" CHECK(json_extract(`document`, '$.id') IS `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vaults_owner_id_unique` ON `vaults` (`owner_id`);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`envelope` text NOT NULL,
	`summary_envelope` text,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pages_id_valid" CHECK(length(`id`) = 30 AND substr(`id`, 1, 4) = 'pag_' AND substr(`id`, 5, 1) GLOB '[0-7]' AND substr(`id`, 6) NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*'),
	CONSTRAINT "pages_revision_positive" CHECK(`revision` > 0),
	CONSTRAINT "pages_envelope_valid" CHECK(json_valid(`envelope`)),
	CONSTRAINT "pages_summary_envelope_valid" CHECK(`summary_envelope` IS NULL OR json_valid(`summary_envelope`))
);
--> statement-breakpoint
CREATE INDEX `pages_vault_id_id` ON `pages` (`vault_id`, `id`);
--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "api_tokens_id_valid" CHECK(length(`id`) = 30 AND substr(`id`, 1, 4) = 'tok_' AND substr(`id`, 5, 1) GLOB '[0-7]' AND substr(`id`, 6) NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*'),
	CONSTRAINT "api_tokens_hash_valid" CHECK(length(`token_hash`) = 64 AND `token_hash` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "api_tokens_expiry_after_creation" CHECK(`expires_at` IS NULL OR `expires_at` > `created_at`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `api_tokens_user_id` ON `api_tokens` (`user_id`);
