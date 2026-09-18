# AK Notes API

A local-first backend foundation using the existing Hono, Chanfana and Zod stack. Route schemas drive validation and OpenAPI documentation. Pages are stored in D1 as encrypted envelopes; there are no plaintext title or block columns.

## Ownership

The database contains `users`, `vaults`, and `pages`. Resource IDs are uppercase ULIDs with type prefixes: `usr_`, `vlt_`, `pag_`, and `tok_`. A vault has an `owner_id` foreign key to `users`, and a unique constraint allows one vault per owner. Each page has a `vault_id` foreign key, with an index on `(vault_id, id)` for scoped pagination. Foreign keys prevent deleting owners or vaults that still have dependent data.

Authentication hashes the bearer token and looks it up in `api_tokens`. Only an unrevoked token whose optional expiry is in the future can authenticate. The middleware sets a typed `ownerId` from the token's `user_id`; request input cannot choose an owner. All vault and page service calls scope their SQL to this identity. Each user has their own vault and may have multiple tokens for different devices. Page saves also require the key ID to match the owned vault.

The API stores only SHA-256 token hashes. Tokens are 32 random bytes encoded as base64url, not user-chosen passwords. Missing, invalid, expired and revoked tokens return 401. Authentication storage failures return 503. Token administration is a local operator command, not a public API endpoint.

Users have a display name and creation timestamp in addition to their stable ID. A user row is the authentication principal representing an owner, not a public account model. Local setup creates a prefixed user ID when it first registers the development token.

## Run locally

From the api directory:

```sh
npm install
npm run db:migrate
npm run setup:local
npm run dev
```

The database schema lives in `src/db/schema.ts` and is the source of truth for tables,
constraints, foreign keys, and indexes. After changing it, generate and review a migration:

```sh
npm run db:generate -- --name describe-the-change
npm run db:migrate
```

`db:migrate` applies pending migrations to local D1; use `db:migrate:remote` explicitly for
the configured remote database. The migration history is code-first: edit the TypeScript
schema, then let Drizzle generate the SQL. Commit generated SQL and the matching files under
`migrations/meta/` together. Avoid `drizzle-kit push`: reviewed migration files are the
deployment contract.

Open http://localhost:8787/ for the interactive documentation. The machine-readable contract is at /openapi.json. Use the token in the ignored `.dev.token` file in the documentation's Authorize dialog or the app's connection form. After migrations, setup imports the existing token into D1 and creates its owner record on first use. On a fresh checkout it creates the local token file first. Re-running setup is safe; it will not reactivate revoked or expired tokens.

Use Node.js 24 or newer for the TypeScript administration scripts. Commands use the local database under `.wrangler/state/v3` by default, matching Wrangler's local persistence. To import the existing `.dev.token` into the production D1 database after remote migrations, run `npm run setup:remote`. To import another token file, add `-- --token-file PATH`; the file is read without printing its contents. Remote access uses your Wrangler credentials.

Wrangler persists local D1 data under `.wrangler/state`. The top-level `aknotes-local` binding is
used by `dev`, `db:migrate`, `setup:local`, and the token administration commands. The remote
`aknotes-prod` binding exists only in the explicit Wrangler `production` environment; the
deployment and `db:migrate:remote` scripts select it with `--env production`. Avoid using
`wrangler dev --remote --env production` unless you intentionally want to access production.
Provision production authentication separately and let the deployment workflow apply remote
migrations before uploading the Worker. See [Cloudflare local D1 documentation](https://developers.cloudflare.com/d1/best-practices/local-development/).

## Issue and revoke tokens

Run these commands from `api/`. A new user ID is generated unless you explicitly supply an existing user ID:

```sh
# Give someone their own empty account, with a token lasting seven days.
npm run tokens -- issue --name "Alex" --label "Alex demo" --days 7

# Issue another device token for an existing user (omit --days for no expiry).
npm run tokens -- issue --user USER_ID --label "Phone"

# List IDs, owners, labels, timestamps and revocation status; never secrets or hashes.
npm run tokens -- list
npm run tokens -- list --user USER_ID

# Revoke a specific token. Other tokens and stored notes remain intact.
npm run tokens -- revoke --id TOKEN_ID
```

The issue command prints the token once, together with its `tok_` token ID and `usr_` user ID. Save it or deliver it privately; it cannot be retrieved with `list`. Treat terminal output as secret. Reusing a label still creates a separate user unless `--user` is supplied. An unknown `--user` is rejected rather than silently creating an account. Use the user ID printed by setup or `list` for additional devices.

A demo user enters their token and then creates their own vault passphrase and recovery key. They have no access to your vault or pages. Revocation and expiry are checked on every subsequent API request; an already-authorized in-flight request may finish, and downloaded data cannot be recalled. Token expiry does not delete the user's vault. The frontend notebook is still a session-only preview; encrypted page saving from the editor is a separate integration task.

Token administration can explicitly target a configured remote environment. Append `--remote --env production` (or `preview`) to `issue`, `list`, `revoke`, or `import`. For example:

```sh
npm run tokens -- import --token-file ./token.txt --remote --env production
npm run tokens -- list --remote --env production
```

Local remains the default, and `--env` is rejected unless `--remote` is also present.
The preview and production D1 bindings are marked `remote: true` so Wrangler's platform proxy
routes these administration commands to Cloudflare rather than to an empty local simulation.

## Endpoints

| Method | Route                               | Purpose                                                      |
| ------ | ----------------------------------- | ------------------------------------------------------------ |
| GET    | /api/v1/pages                       | Owned page summaries with encrypted titles                   |
| GET    | /api/v1/pages/{pageId}              | Fetch one owned encrypted page                               |
| PUT    | /api/v1/pages/{pageId}              | Create or replace an owned page with expectedRevision        |
| GET    | /api/v1/vaults                      | Discover owned vaults (an empty array before setup)          |
| GET    | /api/v1/vaults/{vaultId}            | Fetch an owned vault by prefixed ULID                        |
| POST   | /api/v1/vaults                      | Create the authenticated owner's vault                       |
| PUT    | /api/v1/vaults/{vaultId}/passphrase | Replace the owner's passphrase wrapper with a revision check |

All vault and page routes require bearer authentication. Vault reads and passphrase updates match both the path `vlt_` ID and authenticated owner. Unknown or inaccessible vault reads return 404; a passphrase write without a matching owned vault and revision returns 409. Invalid or incorrectly prefixed IDs return 400. The old singular `/api/v1/vault` routes have been removed; update API and frontend together. Documentation is public and contains no stored pages. Unavailable authentication storage returns 503; invalid, expired or revoked credentials return 401. There is no permissive cross-origin policy; frontend integration will configure the specific development and Tauri origins it needs.

The client generates a `pag_` ULID for each page. PUT with expectedRevision: 0 creates revision 1. An update must provide the current revision; an atomic database condition allows only one concurrent writer to succeed. Stale writes return 409 and leave stored data unchanged. Fetch and reconcile before resubmitting. A lost successful response can produce a conflict on retry; operation-ID deduplication is not implemented yet.

List returns all owned page summaries ordered by opaque ID. Each item includes the opaque ID, revision, server timestamp, and a small encrypted summary envelope containing the title. It never includes the full page envelope. It is a browsing API, not a snapshot or incremental synchronization feed. No delete endpoint is exposed until deletion markers and synchronization semantics are implemented.

## Encrypted envelope version 1

The request contains expectedRevision, envelope, and summaryEnvelope. Unknown payload fields are rejected. Each envelope contains version: 1, algorithm: AES-256-GCM, a UUID keyId, a base64 nonce (12 bytes), and base64 ciphertext including the 16-byte authentication tag. The two envelopes must use different fresh nonces. Request bodies are capped at 1 MiB; ciphertext strings at 700,000 characters.

The client encrypts the full versioned page JSON, including its title and structured blocks, and separately encrypts a versioned page summary containing the page ID and title. Both use the vault's random 256-bit key. The API validates each envelope's shape, not its cryptographic validity: base64 alone does not prove encryption. Never send decryption keys or a vault passphrase to this API.

For client interoperability, document additional authenticated data remains UTF-8 `JSON.stringify(["aknotes-page", 1, pageId, keyId, "AES-256-GCM"])`. Summary additional authenticated data appends the `"summary"` purpose to that array. This preserves existing document compatibility while binding summary ciphertext to its distinct role, preventing the two ciphertexts from being substituted for one another. It does not alone prevent an untrusted server replaying an entire older record; trusted client revision tracking is future work.

The server can observe opaque IDs, revisions, key IDs, timestamps, ciphertext sizes, and access patterns. It cannot read or search titles. Search occurs over decrypted summaries in the unlocked client.

## Validation

```sh
npm test
npm run typecheck
```

Tests bundle the actual Worker and run it against Miniflare D1. They cover client-encrypted round-trip storage and decryption, absence of plaintext in database rows, authorization, invalid payloads, request limits, atomic concurrent edits, pagination and generated OpenAPI. Tests use isolated storage and ephemeral credentials.

## Still to implement

Page encryption and persistence integration, secure native key storage, secure device token storage, encrypted local client persistence, synchronization and conflict UI. Vault creation, unlocking, passphrase key wrapping and recovery are implemented; notebook edits remain session-only. This API foundation does not make the app ready for sensitive notes yet.
