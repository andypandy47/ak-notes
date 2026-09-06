# AK Notes API

A local-first backend foundation using the existing Hono, Chanfana and Zod stack. Route schemas drive validation and OpenAPI documentation. Pages are stored in D1 as encrypted envelopes; there are no plaintext title or block columns.

## Run locally

From the api directory:

```sh
npm install
npm run setup:local
npm run db:migrate
npm run dev
```

Open http://localhost:8787/ for the interactive documentation. The machine-readable contract is at /openapi.json. Use the token in the ignored .dev.token file in the documentation's Authorize dialog. Setup creates a random 256-bit token and stores only its SHA-256 digest in .dev.vars; it refuses to overwrite existing credentials. These are local development credentials, not the vault key. Keep .dev.token private. This file is not a native credential-store implementation.

Wrangler persists local D1 data under .wrangler/state. The database ID in wrangler.jsonc is deliberately a local-only placeholder. No remote resources have been provisioned. Before deployment, configure a real D1 binding, provision production authentication separately, and apply remote migrations explicitly. See [Cloudflare local D1 documentation](https://developers.cloudflare.com/d1/best-practices/local-development/).

## Endpoints

| Method | Route               | Purpose                                                    |
| ------ | ------------------- | ---------------------------------------------------------- |
| GET    | /api/pages          | Paginated metadata, without decrypted titles or ciphertext |
| GET    | /api/pages/{pageId} | Fetch one encrypted page                                   |
| PUT    | /api/pages/{pageId} | Create or replace with expectedRevision                    |

All page routes require bearer authentication. Documentation is public and contains no stored pages. A missing authentication configuration returns 503, invalid credentials return 401. There is no permissive cross-origin policy; frontend integration will configure the specific development and Tauri origins it needs.

The client generates a UUID for each page. PUT with expectedRevision: 0 creates revision 1. An update must provide the current revision; an atomic database condition allows only one concurrent writer to succeed. Stale writes return 409 and leave stored data unchanged. Fetch and reconcile before resubmitting. A lost successful response can produce a conflict on retry; operation-ID deduplication is not implemented yet.

List uses opaque-ID keyset pagination with after and limit (1–100). Follow nextCursor until null. It is a browsing API, not a snapshot or incremental synchronization feed. No delete endpoint is exposed until deletion markers and synchronization semantics are implemented.

## Encrypted envelope version 1

The request contains only expectedRevision and envelope. Unknown payload fields are rejected. The envelope contains version: 1, algorithm: AES-256-GCM, a UUID keyId, a base64 nonce (12 bytes), and base64 ciphertext including the 16-byte authentication tag. Request bodies are capped at 1 MiB; ciphertext strings at 700,000 characters.

The client must encrypt the full versioned page JSON, including its title and structured blocks, with a random 256-bit key and a fresh random nonce for every encryption. The API validates the envelope's shape, not its cryptographic validity: base64 alone does not prove encryption. Never send decryption keys or a vault passphrase to this API.

For client interoperability, additional authenticated data is UTF-8 JSON.stringify(["aknotes-page", 1, pageId, targetRevision, keyId]), where targetRevision is expectedRevision + 1. Decryption must reconstruct this value from the requested page ID, returned revision, and key ID. This binds ciphertext to a page and revision. It does not alone prevent an untrusted server replaying an entire older record; trusted client revision tracking is future work.

The server can observe IDs, revisions, key IDs, timestamps, sizes and access patterns. It cannot perform title search. Search will occur in the unlocked client.

## Validation

```sh
npm test
npm run typecheck
```

Tests bundle the actual Worker and run it against Miniflare D1. They cover client-encrypted round-trip storage and decryption, absence of plaintext in database rows, authorization, invalid payloads, request limits, atomic concurrent edits, pagination and generated OpenAPI. Tests use isolated storage and ephemeral credentials.

## Still to implement

Client encryption integration, vault creation/unlocking, passphrase key wrapping and recovery, secure native key storage, per-device credentials and revocation, encrypted local client persistence, synchronization and conflict UI. The React app is still a session-only prototype. This API foundation does not make the app ready for sensitive notes yet.
